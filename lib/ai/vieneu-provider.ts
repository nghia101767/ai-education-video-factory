import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { storage } from "@/lib/storage";
import { contentHash } from "@/lib/ai/cache";
import { vieneuClient } from "@/lib/ai/vieneu-client";
import type { TTSProvider, TTSRequest, TTSResult } from "@/lib/ai/tts-provider";
const exec = promisify(execFile);
export async function probeAudio(storagePath: string) {
  const filename = storagePath.replace(/^audio\//, "");
  const { stdout } = await exec("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", storage.getPath("audio", filename)]);
  const data = JSON.parse(stdout); const stream = data.streams.find((s: { codec_type: string }) => s.codec_type === "audio");
  const duration = Number(data.format.duration);
  if (!stream || !(duration > 0) || !(Number(stream.sample_rate) > 0) || !(Number(data.format.size) > 44)) throw new Error("TTS_INVALID_AUDIO: invalid audio output");
  return { duration, sampleRate: Number(stream.sample_rate), channels: Number(stream.channels), codec: String(stream.codec_name), fileSize: Number(data.format.size) };
}
export class VieNeuTTSProvider implements TTSProvider {
  name = "vieneu";
  async synthesize(request: TTSRequest): Promise<TTSResult> {
    if (!request.narration.trim() || request.narration.length > 10000) throw new Error("TTS_INVALID_TEXT: narration must contain 1–10000 characters");
    if (request.referenceAudio || request.referenceText) throw new Error("TTS_INVALID_REFERENCE: cloning is not enabled");
    if (request.speed !== undefined && request.speed !== 1) throw new Error("TTS_CONFIGURATION: speed is not supported");
    const { force, ...settings } = request;
    const key = contentHash({ provider: this.name, request: settings });
    const filename = `${key}${force ? "-" + randomUUID() : ""}.wav`;
    const storagePath = `audio/${filename}`;
    if (!force && await storage.exists("audio", filename)) {
      try {
        const metadata = await probeAudio(storagePath);
        if (metadata.sampleRate !== 48000 || metadata.channels !== 1 || metadata.codec !== "pcm_s16le") throw new Error("Invalid VieNeu cache format");
        return { provider: this.name, status: "generated", storagePath, ...metadata, audioSeconds: metadata.duration, estimatedCost: 0, cached: true, message: "CACHE HIT" };
      } catch { /* A damaged cache file must be regenerated. */ }
    }
    const metadata = await vieneuClient.request<{ duration: number; sampleRate: number; channels: number; codec: string; fileSize: number; inferenceMs: number; rtf: number; peakRssMB: number }>({ operation: "synthesize", text: request.narration, voice: request.voice, filename });
    const actual = await probeAudio(storagePath);
    if (actual.sampleRate !== 48000 || actual.channels !== 1 || actual.codec !== "pcm_s16le") throw new Error("TTS_INVALID_AUDIO: expected mono PCM 48kHz WAV");
    return { provider: this.name, status: "generated", storagePath, ...metadata, ...actual, audioSeconds: actual.duration, estimatedCost: 0, cached: false, message: "CACHE MISS: VieNeu speech generated" };
  }
}
