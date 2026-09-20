import { connectToDatabase } from "@/lib/mongodb";
import { Batch, Job } from "@/models";

type Options = { dependencyIds?: unknown[]; batchId?: string; maxAttempts?: number; idempotencyKey?: string };
export async function enqueueJob(type: string, payload: Record<string, unknown>, priority = 0, options: Options = {}) {
  await connectToDatabase();
  if (options.idempotencyKey) { const existing = await Job.findOne({ idempotencyKey: options.idempotencyKey, status: { $nin: ["failed", "cancelled"] } }); if (existing) return existing; }
  return Job.create({ type, payload, priority, dependencyIds: options.dependencyIds || [], batchId: options.batchId, maxAttempts: options.maxAttempts || 3, idempotencyKey: options.idempotencyKey });
}
export async function claimNextJob(workerId: string, leaseMs = 120000) {
  await connectToDatabase(); const now = new Date(); const candidates = await Job.find({ status: "queued", cancellationRequested: { $ne: true }, $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: { $lte: now } }] }).sort({ priority: -1, createdAt: 1 }).limit(25);
  for (const candidate of candidates) {
    if (candidate.batchId) { const batch = await Batch.findOne({ batchId: candidate.batchId }).select("status").lean() as unknown as { status?: string } | null; if (batch?.status !== "running") continue; }
    if (candidate.dependencyIds.length) {
      const failed = await Job.exists({ _id: { $in: candidate.dependencyIds }, status: { $in: ["failed", "cancelled", "blocked", "blocked_budget"] } });
      if (failed) { await Job.updateOne({ _id: candidate._id, status: "queued" }, { $set: { status: "blocked", error: "Dependency failed" } }); continue; }
      const completed = await Job.countDocuments({ _id: { $in: candidate.dependencyIds }, status: "completed" }); if (completed !== candidate.dependencyIds.length) continue;
    }
    const claimed = await Job.findOneAndUpdate({ _id: candidate._id, status: "queued" }, { $set: { status: "processing", workerId, lockedAt: now, leaseExpiresAt: new Date(now.getTime() + leaseMs), startedAt: candidate.startedAt || now }, $unset: { nextAttemptAt: 1 }, $inc: { attempts: 1 } }, { new: true }); if (claimed) return claimed;
  }
  return null;
}
export async function releaseStaleJobs() { await connectToDatabase(); const now = new Date(); return Job.updateMany({ status: "processing", leaseExpiresAt: { $lte: now } }, { $set: { status: "queued", error: "Lease expired; requeued", nextAttemptAt: now }, $unset: { workerId: 1, lockedAt: 1, leaseExpiresAt: 1 } }); }
export async function heartbeatJob(id: unknown, workerId: string, leaseMs = 120000) { const now = new Date(); return Job.updateOne({ _id: id, status: "processing", workerId }, { $set: { lockedAt: now, leaseExpiresAt: new Date(now.getTime() + leaseMs) } }); }
export async function completeJob(id: unknown, workerId: string) { return Job.updateOne({ _id: id, status: "processing", workerId }, { $set: { status: "completed", completedAt: new Date(), error: null }, $unset: { lockedAt: 1, leaseExpiresAt: 1, workerId: 1 } }); }
export async function waitJob(id: unknown, workerId: string, status: "waiting_approval" | "waiting_external" | "blocked_budget", reason: string) { return Job.updateOne({ _id: id, status: "processing", workerId }, { $set: { status, error: reason }, $unset: { lockedAt: 1, leaseExpiresAt: 1, workerId: 1 } }); }
export async function failJob(id: unknown, workerId: string, error: string, retry = true) { const job = await Job.findOne({ _id: id, status: "processing", workerId }); if (!job) return null; const shouldRetry = retry && job.attempts < job.maxAttempts; const result = await Job.updateOne({ _id: id, workerId }, { $set: shouldRetry ? { status: "queued", error, nextAttemptAt: new Date(Date.now() + retryDelay(job.attempts)) } : { status: "failed", error, completedAt: new Date() }, $unset: { lockedAt: 1, leaseExpiresAt: 1, workerId: 1 } }); if (!shouldRetry) await Job.updateMany({ dependencyIds: job._id, status: { $in: ["queued", "waiting_approval", "waiting_external"] } }, { $set: { status: "blocked", error: "Dependency failed" } }); return result; }
export function retryDelay(attempts: number) { return Math.min(300000, 1000 * 2 ** Math.max(0, attempts - 1)); }
