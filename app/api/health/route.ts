import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { storage } from "@/lib/storage";
import { aiProvider } from "@/lib/ai/fallback-provider";
import { imageProvider } from "@/lib/ai/image-provider";
import { ttsProvider } from "@/lib/ai/tts-provider";
import { WorkerHeartbeat } from "@/lib/worker-heartbeat";

export async function GET() {
  let mongodb = "ok", storageStatus = "ok", worker = "unavailable";
  try { await connectToDatabase(); const fresh = await WorkerHeartbeat.exists({ status: "running", lastSeenAt: { $gte: new Date(Date.now() - 30_000) } }); worker = fresh ? "ok" : "unavailable"; } catch { mongodb = "error"; }
  try { await storage.createDirectory(); } catch { storageStatus = "error"; }
  const status = mongodb === "ok" && storageStatus === "ok" ? 200 : 503;
  return NextResponse.json({ application: "ok", mongodb, storage: storageStatus, ffmpeg: "worker-only", worker, providers: { llm: aiProvider.name, image: imageProvider.name, tts: ttsProvider.name, youtube: process.env.YOUTUBE_PROVIDER || "mock-local" }, timestamp: new Date().toISOString() }, { status });
}
