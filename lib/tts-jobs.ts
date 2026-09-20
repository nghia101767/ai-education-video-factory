import { Asset, AssetUsage, Job, Scene, Script, Video } from "@/models";
import { createTTSProvider, ttsCacheKey } from "@/lib/ai/tts-provider";
import { ttsConfig } from "@/lib/ai/config";
import { probeAudio } from "@/lib/ai/vieneu-provider";
import { recordUsage, recordFailure, checkBudget } from "@/lib/ai/usage-service";
import { storage } from "@/lib/storage";
import { createSrt } from "@/lib/subtitles";
import { logger } from "@/lib/logger";

type TTSJob = { _id: unknown; workerId: string; payload: { lessonId?: string; scriptId?: string; voice?: string; model?: string; provider?: string; force?: boolean } };
export async function generateScriptAudio(job: TTSJob) {
  const script = await Script.findOne(job.payload.scriptId ? { _id: job.payload.scriptId, status: "approved" } : { lessonId: job.payload.lessonId, status: "approved" }).sort({ version: -1 });
  if (!script) throw new Error("Script must be approved");
  const id = String(script._id);
  await Job.updateOne({ _id: job._id, workerId: job.workerId }, { $set: { "payload.scriptId": id } });
  const config = ttsConfig();
  if (job.payload.provider && job.payload.provider !== config.provider) throw new Error("TTS_CONFIGURATION: worker and queued provider differ");
  const provider = createTTSProvider(config.provider);
  const model = job.payload.model || config.model; const voice = job.payload.voice || config.voice;
  const scenes = await Scene.find({ scriptId: id }).sort({ sceneNumber: 1 });
  if (!scenes.length) throw new Error("Storyboard is required");
  async function checkOwnership() {
    if (!await Job.exists({ _id: job._id, workerId: job.workerId, status: "processing", cancellationRequested: { $ne: true } })) throw new Error("TTS_CANCELLED: job cancelled or lease lost");
    if (!await Script.exists({ _id: id, status: "approved" })) throw new Error("Script must be approved");
  }
  const results = [];
  for (const scene of scenes) {
    await checkOwnership();
    const request = { narration: String(scene.narration || ""), voice, model, language: "vi" };
    if (!request.narration.trim()) throw new Error("TTS_INVALID_TEXT: empty narration");
    const cacheKey = ttsCacheKey(provider.name, request);
    const started = Date.now();
    let asset = !job.payload.force ? await Asset.findOne({ type: "audio", "metadata.cacheKey": cacheKey, status: { $in: ["generated", "mock"] } }).sort({ createdAt: -1 }) : null;
    let cached = false;
    if (asset?.storagePath) {
      try {
        const actual = await probeAudio(asset.storagePath);
        if (provider.name === "vieneu" && (actual.sampleRate !== 48000 || actual.channels !== 1 || actual.codec !== "pcm_s16le")) throw new Error("Invalid VieNeu cache format");
        cached = true;
      } catch { asset = null; }
    }
    try {
      if (!asset) {
        asset = await Asset.create({ type: "audio", sceneId: scene._id, provider: provider.name, model, status: "requested", hash: cacheKey,
          metadata: { scriptId: id, jobId: String(job._id), cacheKey, voice, inputText: request.narration, language: "vi" } });
        if (config.provider === "openai") await checkBudget();
        const result = await provider.synthesize({ ...request, ...(job.payload.force ? { force: true } : {}) });
        if (!result.storagePath || result.status === "not_configured") throw new Error("TTS_CONFIGURATION: provider not configured");
        const metadata = await probeAudio(result.storagePath);
        asset.storagePath = result.storagePath; asset.filename = result.storagePath.split("/").at(-1);
        asset.mimeType = result.storagePath.endsWith(".wav") ? "audio/wav" : "audio/mpeg";
        asset.status = result.status === "mock" ? "mock" : "generated";
        asset.metadata = { ...asset.metadata, ...metadata, inferenceMs: result.inferenceMs, rtf: result.rtf, peakRssMB: result.peakRssMB, cached: result.cached };
        await asset.save(); cached = result.cached;
      }
      await recordUsage({ provider: provider.name, providerType: config.provider === "openai" ? "cloud" : "local", model, operation: "tts_generation", scriptId: id, sceneId: scene._id,
        cacheKey, audioSeconds: Number(asset.metadata.duration), characters: request.narration.length, durationMs: Date.now() - started, cached, cacheSource: cached ? "Asset/audio" : undefined });
      logger.info(`[TTS] provider=${provider.name} model=${model} voice=${voice} cache=${cached ? "HIT" : "MISS"} job=${job._id} duration=${asset.metadata.duration} output=${asset.storagePath}`);
      results.push({ scene, asset, cached });
    } catch (error) {
      const message = error instanceof Error ? error.message : "TTS failed";
      if (asset?.status === "requested") { asset.status = "failed"; asset.metadata = { ...asset.metadata, error: message }; await asset.save(); }
      await recordFailure({ provider: provider.name, model, operation: "tts_generation", scriptId: id, sceneId: scene._id, cacheKey, durationMs: Date.now() - started, error: message });
      throw error;
    }
  }
  await checkOwnership();
  // Verify the storyboard snapshot before assigning new assets or timing.
  for (const { scene } of results) if (!await Scene.exists({ _id: scene._id, narration: scene.narration, updatedAt: scene.updatedAt })) throw new Error("TTS_INVALID_INPUT: storyboard changed; generate voice again");
  let cursor = 0;
  for (const { scene, asset } of results) {
    await checkOwnership();
    const oldAudio = await Asset.find({ _id: { $in: scene.assetIds }, type: "audio" }).select("_id");
    const oldIds = oldAudio.map(a => String(a._id));
    const duration = config.provider === "vieneu" ? Number(asset.metadata.duration) : scene.duration;
    await Scene.updateOne({ _id: scene._id }, { $set: {
      assetIds: [...scene.assetIds.filter((v: unknown) => !oldIds.includes(String(v))), asset._id],
      startTime: cursor, duration, endTime: cursor + duration,
    } });
    await AssetUsage.deleteMany({ sceneId: scene._id, assetId: { $in: oldAudio.map(a => a._id) } });
    await AssetUsage.updateOne({ sceneId: scene._id, assetId: asset._id }, { usageType: "generated" }, { upsert: true });
    cursor += duration;
  }
  const updated = await Scene.find({ scriptId: id }).sort({ sceneNumber: 1 });
  for (const video of await Video.find({ scriptId: id })) {
    const filename = `${video._id}.srt`;
    await storage.save("subtitles", filename, createSrt(updated.map(s => ({ text: s.subtitleText || s.narration, start: s.startTime, end: s.endTime }))));
    await Video.updateOne({ _id: video._id }, { duration: cursor, subtitlePath: `subtitles/${filename}` });
  }
  await Job.updateOne({ _id: job._id, workerId: job.workerId, status: "processing" }, { $set: { "payload.result": { assetIds: results.map(r => String(r.asset._id)), cached: results.every(r => r.cached), duration: cursor } } });
}
