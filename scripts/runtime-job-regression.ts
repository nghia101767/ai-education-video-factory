import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { claimNextJob, completeJob, failJob, releaseStaleJobs } from "@/lib/jobs";
import { Batch, Job } from "@/models";
import { connectToDatabase } from "@/lib/mongodb";

async function main() {
  await connectToDatabase(); const batchId = `regression-${randomUUID()}`; const worker = `regression-${process.pid}`;
  await Batch.create({ batchId, lessonIds: [], steps: [], status: "running" });
  const first = await Job.create({ type: "lesson_analysis", payload: { marker: batchId }, batchId, priority: 20 });
  const dependent = await Job.create({ type: "script_generation", payload: { marker: batchId }, batchId, dependencyIds: [first._id], priority: 100 });
  const claimedFirst = await claimNextJob(worker); if (!claimedFirst?._id.equals(first._id)) throw new Error("Claimed a dependent job before its prerequisite");
  await completeJob(first._id, worker); const claimedDependent = await claimNextJob(worker); if (!claimedDependent?._id.equals(dependent._id)) throw new Error("Did not claim dependent job after prerequisite completion"); await completeJob(dependent._id, worker);

  const failing = await Job.create({ type: "asset_generation", payload: { marker: batchId }, batchId, priority: 50, maxAttempts: 1 });
  const blocked = await Job.create({ type: "video_render", payload: { marker: batchId }, batchId, dependencyIds: [failing._id], priority: 100 });
  const independent = await Job.create({ type: "lesson_analysis", payload: { marker: batchId }, batchId, priority: 10 });
  const claimedFailing = await claimNextJob(worker); if (!claimedFailing?._id.equals(failing._id)) throw new Error("Unexpected failure-test claim"); await failJob(failing._id, worker, "forced regression failure");
  const blockedState = await Job.findById(blocked._id); const claimedIndependent = await claimNextJob(worker); if (!claimedIndependent?._id.equals(independent._id)) throw new Error("Independent job did not continue"); await completeJob(independent._id, worker);

  const stale = await Job.create({ type: "lesson_analysis", payload: { marker: batchId }, batchId, status: "processing", workerId: "crashed-worker", lockedAt: new Date(Date.now() - 300_000), leaseExpiresAt: new Date(Date.now() - 1_000) });
  await releaseStaleJobs(); const staleState = await Job.findById(stale._id); const recovered = await claimNextJob(worker); if (!recovered?._id.equals(stale._id)) throw new Error("Stale job was not reclaimable"); await completeJob(stale._id, worker);
  const failingState = await Job.findById(failing._id);
  const independentState = await Job.findById(independent._id);
  console.log(JSON.stringify({
    batchId,
    dependencyOrder: [claimedFirst.type, claimedDependent.type],
    failing: failingState?.status,
    dependentAfterFailure: blockedState?.status,
    independent: independentState?.status,
    staleRecovery: staleState?.status,
    staleReclaimed: recovered.status,
  }));
  await Batch.updateOne({ batchId }, { status: "completed" });
  await mongoose.disconnect();
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
