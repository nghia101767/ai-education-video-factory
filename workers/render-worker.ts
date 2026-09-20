import { ttsConfig } from "@/lib/ai/config";
import { vieneuClient } from "@/lib/ai/vieneu-client";
import { storage } from "@/lib/storage";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Batch, RenderJob, Video } from "@/models";
import { logger } from "@/lib/logger";
import { renderVideo, type RenderScene } from "@/lib/render-engine";
import { claimNextJob, heartbeatJob, releaseStaleJobs } from "@/lib/jobs";
import { executePipelineJob, handlePipelineFailure, reconcilePipelineJobs } from "@/lib/pipeline-executor";
import { WorkerHeartbeat } from "@/lib/worker-heartbeat";

const exec = promisify(execFile); const workerId = `${process.env.HOSTNAME || "render-worker"}-${process.pid}`; let shuttingDown = false;
async function updateOwned(id: unknown, update: Record<string, unknown>) { return RenderJob.updateOne({ _id: id, status: "processing", workerId }, update); }
async function processNextJob() {
  const now = new Date();
  const candidates = await RenderJob.find({ cancellationRequested: { $ne: true }, $or: [{ status: "queued" }, { status: "processing", leaseExpiresAt: { $lte: now } }] }).sort({ createdAt: 1 }).limit(20);
  let job = null;
  for (const candidate of candidates) {
    if (candidate.batchId) {
      const batch = await Batch.findOne({ batchId: candidate.batchId }).select("status").lean() as unknown as { status?: string } | null;
      if (batch?.status !== "running") continue;
    }
    job = await RenderJob.findOneAndUpdate({ _id: candidate._id, $or: [{ status: "queued" }, { status: "processing", leaseExpiresAt: { $lte: now } }] }, { $set: { status: "processing", currentStep: "Preparing", progress: 5, startedAt: candidate.startedAt || now, workerId, lockedAt: now, leaseExpiresAt: new Date(now.getTime() + 120000) } }, { new: true });
    if (job) break;
  }
  if (!job) return false;
  const controller = new AbortController();
  const cancellationPoll = setInterval(async () => { try { const state = await RenderJob.findById(job._id).select("cancellationRequested workerId status").lean() as unknown as { cancellationRequested?: boolean; workerId?: string; status?: string } | null; if (!state || state.cancellationRequested || state.workerId !== workerId || state.status !== "processing") controller.abort(); } catch { logger.error("Render cancellation check unavailable"); } }, 500);
  try {
    const outputName = `render-${job.videoId.toString()}-${job._id.toString()}.mp4`;
    const renderSettings = job.renderSettings as { width?: number; height?: number; fps?: number; subtitleMargin?: number; backgroundMusicPath?: string }; const result = await renderVideo({ outputName, scenes: job.inputAssets as RenderScene[], settings: renderSettings, backgroundMusicPath: renderSettings.backgroundMusicPath }, { signal: controller.signal, onProgress: async (progress, currentStep) => { await updateOwned(job._id, { $set: { progress, currentStep, lockedAt: new Date(), leaseExpiresAt: new Date(Date.now() + 120000) } }); } });
    const completed = await updateOwned(job._id, { $set: { status: "completed", progress: 100, currentStep: "Completed", outputPath: result.outputPath, subtitlePath: result.subtitlePath, logs: result.logs.slice(-100), completedAt: new Date() }, $unset: { workerId: 1, lockedAt: 1, leaseExpiresAt: 1 } });
    if (completed.modifiedCount) { await Video.findByIdAndUpdate(job.videoId, { status: "ready_for_review", outputPath: result.outputPath, subtitlePath: result.subtitlePath, duration: result.duration }); logger.info(`Render job completed: ${job._id}`); }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render failed"; const current = await RenderJob.findById(job._id).select("cancellationRequested retryCount maxAttempts workerId").lean() as unknown as { cancellationRequested?: boolean; retryCount?: number; maxAttempts?: number; workerId?: string } | null;
    if (current?.workerId === workerId) {
      if (current.cancellationRequested || controller.signal.aborted) { await updateOwned(job._id, { $set: { status: "cancelled", currentStep: "Cancelled", error: "Cancellation requested", completedAt: new Date() }, $unset: { workerId: 1, lockedAt: 1, leaseExpiresAt: 1 } }); await Video.findByIdAndUpdate(job.videoId, { status: "draft" }); }
      else { const retryCount = Number(current.retryCount || 0) + 1; const retry = retryCount < Number(current.maxAttempts || 3); await updateOwned(job._id, { $set: { status: retry ? "queued" : "failed", retryCount, currentStep: retry ? "Retry queued" : "Failed", error: message, ...(retry ? {} : { completedAt: new Date() }) }, $unset: { workerId: 1, lockedAt: 1, leaseExpiresAt: 1 } }); if (!retry) await Video.findByIdAndUpdate(job.videoId, { status: "failed" }); logger.error(`Render job ${retry ? "retry" : "failed"}: ${job._id}`, error); }
    }
  } finally { clearInterval(cancellationPoll); }
  return true;
}
async function processNextPipelineJob() { const job = await claimNextJob(workerId); if (!job) return false; const heartbeat = setInterval(() => { void heartbeatJob(job._id, workerId).catch(() => logger.error("Pipeline heartbeat unavailable; lease recovery remains enabled")); }, 30000); try { await executePipelineJob(job as never); } catch (error) { await handlePipelineFailure(job as never, error); } finally { clearInterval(heartbeat); } return true; }
async function main() {
  try {
    await exec("ffmpeg", ["-version"]); await connectToDatabase(); await WorkerHeartbeat.findOneAndUpdate({ workerId }, { workerId, status: "running", capabilities: ["pipeline", "ffmpeg", "render"], lastSeenAt: new Date() }, { upsert: true }); logger.info(`Render worker ready with FFmpeg and MongoDB (${workerId})`);
    await storage.createDirectory("audio");
    if (ttsConfig().provider === "vieneu") { try { await vieneuClient.request({ operation: "health" }); logger.info("[TTS] VieNeu service available"); } catch { logger.info("WARNING: VieNeu-TTS unavailable; TTS jobs will use bounded retry"); } }
    const heartbeat = setInterval(() => { void Promise.all([RenderJob.updateMany({ workerId, status: "processing" }, { $set: { lockedAt: new Date(), leaseExpiresAt: new Date(Date.now() + 120000) } }), WorkerHeartbeat.updateOne({ workerId }, { status: "running", lastSeenAt: new Date() })]).catch(() => logger.error("Worker heartbeat unavailable; MongoDB reconnecting")); }, 10000);
    const shutdown = () => { shuttingDown = true; logger.info("Render worker shutting down after current job"); };
    process.once("SIGTERM", shutdown); process.once("SIGINT", shutdown);
    let maintenanceAt = 0; while (!shuttingDown) { try { if (Date.now() - maintenanceAt > 10000) { await releaseStaleJobs(); await reconcilePipelineJobs(); maintenanceAt = Date.now(); } const pipelineProcessed = await processNextPipelineJob(); const renderProcessed = pipelineProcessed ? false : await processNextJob(); if (!pipelineProcessed && !renderProcessed && !shuttingDown) await new Promise((resolve) => setTimeout(resolve, 2000)); } catch { logger.error("Worker queue unavailable; retrying after reconnect"); await new Promise(resolve => setTimeout(resolve, 5000)); } }
    clearInterval(heartbeat); await Promise.all([RenderJob.updateMany({ workerId, status: "processing" }, { $set: { status: "queued", error: "Worker shutdown; requeued" }, $unset: { workerId: 1, lockedAt: 1, leaseExpiresAt: 1 } }), WorkerHeartbeat.updateOne({ workerId }, { status: "stopping", lastSeenAt: new Date() })]); await mongoose.disconnect();
  } catch (error) { logger.error("Render worker unavailable", error); process.exitCode = 1; }
}
void main();
