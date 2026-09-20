import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { Job } from "@/models";
import { connectToDatabase } from "@/lib/mongodb";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
  await connectToDatabase(); const job = await Job.findById(id).lean();
  return job ? NextResponse.json(job) : NextResponse.json({ error: "Job not found" }, { status: 404 });
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  await connectToDatabase();
  if (body.action === "cancel") {
    const job = await Job.findOneAndUpdate({ _id: id, type: "tts_generation", status: { $in: ["queued", "processing"] } },
      { $set: { cancellationRequested: true, status: "cancelled", completedAt: new Date(), error: "Cancellation requested" } }, { new: true });
    return job ? NextResponse.json(job) : NextResponse.json({ error: "No active TTS job" }, { status: 409 });
  }
  if (body.action === "retry") {
    const job = await Job.findOneAndUpdate({ _id: id, type: "tts_generation", status: { $in: ["failed", "cancelled"] } },
      { $set: { status: "queued", attempts: 0, cancellationRequested: false }, $unset: { workerId: 1, completedAt: 1, error: 1, nextAttemptAt: 1, leaseExpiresAt: 1, lockedAt: 1 } }, { new: true });
    return job ? NextResponse.json(job) : NextResponse.json({ error: "Only failed/cancelled TTS jobs can retry" }, { status: 409 });
  }
  return NextResponse.json({ error: "action must be retry or cancel" }, { status: 400 });
}
