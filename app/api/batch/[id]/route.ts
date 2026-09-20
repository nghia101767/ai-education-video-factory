import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Batch, Job, RenderJob } from "@/models";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  await connectToDatabase();
  const batchId = (await params).id;
  const batch = await Batch.findOne({ batchId }).lean();
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  const [jobs, renderJobs] = await Promise.all([Job.find({ batchId }).sort({ createdAt: 1 }).lean(), RenderJob.find({ batchId }).sort({ createdAt: 1 }).lean()]);
  return NextResponse.json({ batch, jobs, renderJobs });
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const batchId = (await params).id;
    const { action } = await request.json();
    await connectToDatabase();
    const batch = await Batch.findOne({ batchId });
    if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    if (action === "pause" && batch.status === "running") batch.status = "paused";
    else if (action === "resume" && batch.status === "paused") batch.status = "running";
    else if (action === "cancel" && !["cancelled", "completed"].includes(batch.status)) {
      batch.status = "cancelled";
      await Job.updateMany({ batchId, status: { $in: ["queued", "waiting_approval", "waiting_external", "blocked", "blocked_budget"] } }, { status: "cancelled", completedAt: new Date() });
      await Job.updateMany({ batchId, status: "processing" }, { status: "cancellation_requested", cancellationRequested: true, error: "Batch cancellation requested" });
      await RenderJob.updateMany({ batchId, status: "queued" }, { status: "cancelled", cancellationRequested: true, currentStep: "Cancelled", error: "Batch cancellation requested", completedAt: new Date() });
      await RenderJob.updateMany({ batchId, status: "processing" }, { cancellationRequested: true, currentStep: "Cancellation requested" });
    } else if (action === "retry_failed") {
      batch.status = "running";
      await Job.updateMany({ batchId, status: "failed" }, { status: "queued", attempts: 0, error: null, cancellationRequested: false, $unset: { completedAt: 1, nextAttemptAt: 1 } });
      await Job.updateMany({ batchId, status: "blocked" }, { status: "queued", error: null });
    } else return NextResponse.json({ error: "Action is not valid for current batch state" }, { status: 409 });
    await batch.save();
    return NextResponse.json(batch);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Batch action failed" }, { status: 400 });
  }
}
