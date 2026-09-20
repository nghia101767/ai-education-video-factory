import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { storage } from "@/lib/storage";
import { createSrt } from "@/lib/subtitles";
import { env } from "@/lib/env";

export type RenderScene = { sceneNumber: number; startTime: number; endTime: number; duration: number; subtitleText: string; imagePath: string; audioPath: string; audioProvider?: string; sfxPath?: string };
export type RenderSettings = { width: number; height: number; fps: number; subtitleMargin: number };
export type RenderSpec = { outputName: string; scenes: RenderScene[]; settings?: Partial<RenderSettings>; backgroundMusicPath?: string };
export type RenderResult = { outputPath: string; subtitlePath: string; duration: number; logs: string[] };
export function safeStorageFilename(value: string) { if (!/^[a-zA-Z0-9._/-]+$/.test(value) || value.includes("..")) throw new Error("Invalid storage path"); return value; }
export function resolveStoragePath(value: string) { if (path.isAbsolute(value)) { const root = path.resolve(env.storageRoot); const target = path.resolve(value); if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Invalid render asset path"); return target; } const [folder, ...rest] = safeStorageFilename(value).split("/"); if (!["images", "audio", "videos", "subtitles", "thumbnails"].includes(folder) || !rest.length) throw new Error("Invalid render asset path"); return storage.getPath(folder as "images" | "audio" | "videos" | "subtitles" | "thumbnails", rest.join("/")); }

async function runFfmpeg(args: string[], signal?: AbortSignal, logs: string[] = []) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] }); let stderr = "";
    const terminate = () => { child.kill("SIGTERM"); setTimeout(() => { if (!child.killed) child.kill("SIGKILL"); }, 2000).unref(); };
    signal?.addEventListener("abort", terminate, { once: true });
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk.toString()).slice(-16000); });
    child.once("error", reject);
    child.once("close", (code, killedSignal) => { signal?.removeEventListener("abort", terminate); logs.push(...stderr.split("\n").filter(Boolean).slice(-8)); if (signal?.aborted) reject(new Error("Render cancelled")); else if (code === 0) resolve(); else reject(new Error(`FFmpeg failed (${code ?? killedSignal ?? "unknown"})`)); });
  });
}

export async function renderVideo(spec: RenderSpec, options: { signal?: AbortSignal; onProgress?: (progress: number, step: string) => Promise<void> | void } = {}): Promise<RenderResult> {
  if (spec.scenes.length < 5 || spec.scenes.length > 7) throw new Error("Render requires 5–7 scenes");
  const duration = Number(spec.scenes.reduce((sum, scene) => sum + scene.duration, 0).toFixed(2));
  if (!Number.isFinite(duration) || duration <= 0 || duration > 1800 || spec.scenes.some(scene => !Number.isFinite(scene.duration) || scene.duration <= 0)) throw new Error("Invalid render duration");
  if (!spec.scenes.every(scene => scene.audioProvider === "vieneu") && (duration < 25 || duration > 35)) throw new Error("Render duration must be 25–35 seconds");
  const settings: RenderSettings = { width: Number(spec.settings?.width || 1080), height: Number(spec.settings?.height || 1920), fps: Number(spec.settings?.fps || 30), subtitleMargin: Number(spec.settings?.subtitleMargin || 300) };
  if (![settings.width, settings.height, settings.fps, settings.subtitleMargin].every(Number.isInteger) || settings.width < 240 || settings.width > 2160 || settings.height < 240 || settings.height > 3840 || settings.width % 2 || settings.height % 2 || settings.fps < 1 || settings.fps > 60 || settings.subtitleMargin < 1 || settings.subtitleMargin >= settings.height / 2) throw new Error("Invalid render settings");
  await storage.createDirectory("videos"); await storage.createDirectory("subtitles"); await storage.createDirectory("temp");
  const base = path.parse(safeStorageFilename(spec.outputName)).name; const tempRoot = await fs.mkdtemp(storage.getPath("temp", `${base}-`)); const logs: string[] = [];
  const subtitleName = `${base}.srt`; const subtitlePath = storage.getPath("subtitles", subtitleName);
  await storage.save("subtitles", subtitleName, createSrt(spec.scenes.map((scene) => ({ text: scene.subtitleText, start: scene.startTime, end: scene.endTime }))));
  try {
    const segments: string[] = []; await options.onProgress?.(15, "Preparing scenes");
    for (let index = 0; index < spec.scenes.length; index += 1) {
      if (options.signal?.aborted) throw new Error("Render cancelled");
      const scene = spec.scenes[index]; const segment = path.join(tempRoot, `scene-${index + 1}.mp4`); segments.push(segment);
      const inputs = ["-y", "-loop", "1", "-i", resolveStoragePath(scene.imagePath), "-i", resolveStoragePath(scene.audioPath)]; if (scene.sfxPath) inputs.push("-i", resolveStoragePath(scene.sfxPath)); const audioFilter = scene.sfxPath ? `[1:a]aresample=48000,apad,atrim=0:${scene.duration},volume=1[voice];[2:a]aresample=48000,apad,atrim=0:${scene.duration},volume=.25[sfx];[voice][sfx]amix=inputs=2:duration=first:normalize=0,alimiter=limit=.95[a]` : `[1:a]aresample=48000,apad,atrim=0:${scene.duration},volume=1,alimiter=limit=.95[a]`; await runFfmpeg([...inputs, "-t", String(scene.duration), "-filter_complex", `[0:v]scale=${settings.width}:${settings.height}:force_original_aspect_ratio=increase,crop=${settings.width}:${settings.height},setsar=1,fps=${settings.fps},format=yuv420p[v];${audioFilter}`, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", segment], options.signal, logs);
      await options.onProgress?.(20 + Math.round((index + 1) / spec.scenes.length * 45), `Rendered scene ${index + 1}/${spec.scenes.length}`);
    }
    const concatList = path.join(tempRoot, "concat.txt"); await fs.writeFile(concatList, segments.map((segment) => `file '${segment.replace(/'/g, "'\\''")}'`).join("\n"));
    const joined = path.join(tempRoot, "joined.mp4"); await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", concatList, "-c", "copy", joined], options.signal, logs);
    await options.onProgress?.(75, "Burning subtitles");
    const output = storage.getPath("videos", safeStorageFilename(spec.outputName)); const escapedSubtitle = subtitlePath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
    const subtitleFilter = `subtitles='${escapedSubtitle}':force_style='FontName=DejaVu Sans,FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=1,Alignment=2,MarginV=${settings.subtitleMargin}'`; if (spec.backgroundMusicPath) { const fadeOut = Math.max(0, duration - 1); await runFfmpeg(["-y", "-i", joined, "-stream_loop", "-1", "-i", resolveStoragePath(spec.backgroundMusicPath), "-filter_complex", `[0:v]${subtitleFilter}[v];[1:a]aresample=48000,atrim=0:${duration},volume=.12,afade=t=in:st=0:d=1,afade=t=out:st=${fadeOut}:d=1[music];[0:a][music]amix=inputs=2:duration=first:normalize=0,alimiter=limit=.95[a]`, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-r", String(settings.fps), "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", output], options.signal, logs); } else await runFfmpeg(["-y", "-i", joined, "-vf", subtitleFilter, "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-r", String(settings.fps), "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", output], options.signal, logs);
    await options.onProgress?.(95, "Finalizing");
    return { outputPath: output, subtitlePath, duration, logs };
  } finally { await fs.rm(tempRoot, { recursive: true, force: true }); }
}

export async function renderSample(outputName: string, duration = 3) { const output = storage.getPath("videos", safeStorageFilename(outputName)); await storage.createDirectory("videos"); await runFfmpeg(["-y", "-f", "lavfi", "-i", "color=c=0x0e9b62:s=1080x1920:r=30", "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000", "-t", String(duration), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "128k", "-shortest", output]); return output; }
