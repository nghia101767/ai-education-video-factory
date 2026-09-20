import { generateScriptAudio } from "@/lib/tts-jobs";
import { analyzeLessonJob } from "@/lib/pipeline-operations";
import { Batch, Job, PipelineState, RenderJob, Scene, Script, Video } from "@/models";
import { completeJob, failJob, waitJob } from "@/lib/jobs";

type JobRecord = { _id: unknown; type: string; workerId: string; batchId?: string; payload: { lessonId?: string; scriptId?: string; voice?: string; model?: string; provider?: string; force?: boolean }; cancellationRequested?: boolean };
export async function executePipelineJob(job: JobRecord) {
  const lessonId = String(job.payload.lessonId || ""); if (!lessonId) throw new Error("Job has no lessonId");
  const outcome = job.type === "tts_generation" ? (await generateScriptAudio(job), { status: "completed" as const, message: "Voice completed" }) : await analyzeLessonJob(job.type, lessonId, job.batchId);
  const current = await Job.findById(job._id).select("status cancellationRequested").lean() as unknown as { status: string; cancellationRequested?: boolean } | null;
  if (!current || current.cancellationRequested || current.status === "cancellation_requested") { await Job.updateOne({ _id: job._id }, { status: "cancelled", completedAt: new Date(), error: "Cancellation requested", $unset: { workerId: 1, lockedAt: 1, leaseExpiresAt: 1 } }); return; }
  if (outcome.status === "waiting_approval" || outcome.status === "waiting_external" || outcome.status === "blocked_budget") await waitJob(job._id, job.workerId, outcome.status, outcome.message);
  else await completeJob(job._id, job.workerId);
  await PipelineState.updateOne({ lessonId }, { $set: { [`steps.${job.type}`]: outcome.status === "completed" ? "completed" : outcome.status, status: outcome.status === "completed" ? "processing" : "blocked" } });
}

export async function reconcilePipelineJobs() {
  const waiting = await Job.find({ type: "video_render", status: "waiting_external" }).limit(50);
  for (const job of waiting) {
    const video = await Video.findOne({ lessonId: job.payload.lessonId }).sort({ createdAt: -1 }).lean() as unknown as { _id: unknown; status: string } | null; if (!video) continue;
    const render = await RenderJob.findOne({ videoId: video._id }).sort({ createdAt: -1 }).lean() as unknown as { status: string; error?: string } | null;
    if (render?.status === "completed" && ["ready_for_review", "approved", "published"].includes(video.status)) { await Job.updateOne({ _id: job._id, status: "waiting_external" }, { status: "completed", completedAt: new Date(), error: null }); await PipelineState.updateOne({ lessonId: job.payload.lessonId }, { $set: { "steps.video_render": "completed", status: "blocked" } }); }
    else if (render?.status === "failed") { await Job.updateOne({ _id: job._id, status: "waiting_external" }, { status: "failed", completedAt: new Date(), error: render.error || "Render failed" }); await Job.updateMany({ dependencyIds: job._id, status: "queued" }, { status: "blocked", error: "Dependency failed" }); }
  }
  const storyboardWait = await Job.find({ type: "storyboard_generation", status: "waiting_approval" }).limit(50);
  for (const job of storyboardWait) {
    const approvedScript = await Script.findOne({ lessonId: job.payload.lessonId, status: "approved" }).select("_id").lean() as unknown as { _id: unknown } | null;
    if (approvedScript) await Job.updateOne({ _id: job._id, status: "waiting_approval" }, { status: "queued", error: null });
  }
  const publishWait = await Job.find({ type: "youtube_publish", status: "waiting_approval" }).limit(50);
  for (const job of publishWait) if (await Video.exists({ lessonId: job.payload.lessonId, status: "approved" })) await Job.updateOne({ _id: job._id, status: "waiting_approval" }, { status: "queued", error: null });
  const activeBatches = await Batch.find({ status: { $in: ["running", "paused"] } }).select("batchId status").lean() as unknown as Array<{ batchId: string; status: string }>;
  for (const batch of activeBatches) {
    const counts = await Job.aggregate([{ $match: { batchId: batch.batchId } }, { $group: { _id: "$status", count: { $sum: 1 } } }]);
    const byStatus = Object.fromEntries(counts.map((row) => [row._id, row.count])) as Record<string, number>;
    const unfinished = ["queued", "processing", "waiting_approval", "waiting_external", "blocked_budget", "cancellation_requested"].some((status) => byStatus[status]);
    if (!unfinished) await Batch.updateOne({ batchId: batch.batchId, status: { $in: ["running", "paused"] } }, { status: byStatus.failed || byStatus.blocked ? "failed" : "completed" });
  }
}

export async function handlePipelineFailure(job: JobRecord, error: unknown) {
  const message = error instanceof Error ? error.message : "Pipeline job failed";
  if (/TTS_CANCELLED/.test(message)) { await Job.updateOne({ _id: job._id, workerId: job.workerId }, { status: "cancelled", completedAt: new Date(), $unset: { workerId: 1, lockedAt: 1, leaseExpiresAt: 1 } }); return; }
  await failJob(job._id, job.workerId, message, !/not configured|required|must be approved|not found|TTS_INVALID|TTS_CONFIGURATION|VIENEU_NOT_AVAILABLE|VIENEU_MODEL_ERROR/i.test(message));
  await PipelineState.updateOne({ lessonId: job.payload.lessonId }, { $set: { [`steps.${job.type}`]: "failed", status: "failed" } });
}

export async function loadRenderInputs(lessonId: string) {
  const script = await Script.findOne({ lessonId, status: "approved" }).sort({ version: -1 }).select("_id").lean() as unknown as { _id: unknown } | null; if (!script) return null;
  return Scene.find({ scriptId: script._id }).sort({ sceneNumber: 1 }).lean();
}
