import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Job, Scene, Script, RenderJob, Video } from "@/models";
import { enqueueJob } from "@/lib/jobs";
import { ttsConfig } from "@/lib/ai/config";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Invalid script ID" }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !["voice", "force", "speed", "referenceAudio", "referenceText"].includes(key))) return NextResponse.json({ error: "Invalid TTS request" }, { status: 400 });
  if (body.referenceAudio || body.referenceText || body.speed !== undefined) return NextResponse.json({ error: "Preset voices only; speed and cloning are not enabled" }, { status: 400 });
  const config = ttsConfig(); const voice = body.voice ?? config.voice;
  if (typeof voice !== "string" || !voice.trim() || voice.length > 100) return NextResponse.json({ error: "Invalid voice" }, { status: 400 });
  await connectToDatabase();
  const script = await Script.findById(id);
  if (!script) return NextResponse.json({ error: "Script not found" }, { status: 404 });
  if (script.status !== "approved") return NextResponse.json({ error: "Script must be approved" }, { status: 409 });
  const scenes = await Scene.find({ scriptId: id });
  if (!scenes.length) return NextResponse.json({ error: "Storyboard is required" }, { status: 409 });
  if (scenes.some(scene => !scene.narration?.trim())) return NextResponse.json({ error: "TTS_INVALID_TEXT: empty narration" }, { status: 400 });
  const videos = await Video.find({ scriptId: id }).select("_id");
  if (await RenderJob.exists({ videoId: { $in: videos.map(v => v._id) }, status: { $in: ["queued", "processing"] } })) return NextResponse.json({ error: "Wait for the active render before changing audio" }, { status: 409 });
  const active = await Job.findOne({ type: "tts_generation", "payload.scriptId": id, status: { $in: ["queued", "processing", "cancellation_requested"] } });
  const job = active || await enqueueJob("tts_generation", { lessonId: String(script.lessonId), scriptId: id, voice, model: config.model, provider: config.provider, force: body.force === true });
  return NextResponse.json({ jobId: String(job._id), status: job.status }, { status: 202 });
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Invalid script ID" }, { status: 400 });
  await connectToDatabase();
  const script = await Script.findById(id).select("lessonId");
  if (!script) return NextResponse.json({ error: "Script not found" }, { status: 404 });
  const job = await Job.findOne({ type: "tts_generation", $or: [{ "payload.scriptId": id }, { "payload.lessonId": String(script.lessonId), "payload.scriptId": { $exists: false } }] }).sort({ createdAt: -1 }).select("status error attempts createdAt completedAt payload.voice").lean();
  return NextResponse.json({ job });
}
