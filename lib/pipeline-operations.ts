import { aiProvider } from "@/lib/ai/fallback-provider";
import { llmConfig } from "@/lib/ai/config";
import { checkBudget, recordFailure, recordUsage } from "@/lib/ai/usage-service";
import { generateYouTubeMetadata, realYouTubeProvider } from "@/lib/youtube";
import { PublishingJob, Scene, Script, Video, YouTubeChannel } from "@/models";
import { POST as analyze } from "@/app/api/lessons/[id]/analyze/route";
import { POST as generateScript } from "@/app/api/lessons/[id]/scripts/generate/route";
import { POST as generateStoryboard } from "@/app/api/scripts/[id]/storyboard/route";
import { POST as generateAsset } from "@/app/api/scenes/[id]/generate-asset/route";
import { POST as queueRender } from "@/app/api/videos/[id]/render/route";

type Outcome = { status: "completed" | "waiting_approval" | "waiting_external" | "blocked_budget"; message: string };
async function invoke(handler: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>, id: string, body?: unknown) { const response = await handler(new Request("http://worker.internal", body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) }); const result = await response.json(); if (!response.ok) { if (response.status === 429) return { blocked: true, message: String(result.error || "AI budget exceeded") }; throw new Error(String(result.error || `Operation failed (${response.status})`)); } return { result }; }
export async function analyzeLessonJob(type: string, lessonId: string, batchId?: string): Promise<Outcome> {
  if (type === "lesson_analysis") { const result = await invoke(analyze, lessonId); return { status: result.blocked ? "blocked_budget" : "completed", message: result.message || "Analysis completed" }; }
  if (type === "script_generation") { const result = await invoke(generateScript, lessonId); return { status: result.blocked ? "blocked_budget" : "completed", message: result.message || "Script completed" }; }
  const script = await Script.findOne({ lessonId, status: "approved" }).sort({ version: -1 }).lean() as unknown as { _id: unknown; title: string; educationalGoal?: string } | null;
  if (!script) return { status: "waiting_approval", message: "Waiting for script approval" };
  const scriptId = String(script._id);
  if (type === "storyboard_generation") { const result = await invoke(generateStoryboard, scriptId); return { status: result.blocked ? "blocked_budget" : "completed", message: result.message || "Storyboard completed" }; }
  if (type === "asset_generation") { const scenes = await Scene.find({ scriptId }).sort({ sceneNumber: 1 }).select("_id").lean(); if (!scenes.length) throw new Error("Storyboard is required"); for (const scene of scenes) { const result = await invoke(generateAsset, String(scene._id)); if (result.blocked) return { status: "blocked_budget", message: result.message || "AI budget exceeded" }; } return { status: "completed", message: "Assets completed" }; }
  const video = await Video.findOne({ lessonId, scriptId }).sort({ createdAt: -1 }).lean() as unknown as { _id: unknown; status: string; outputPath?: string; title: string } | null;
  if (!video) throw new Error("Video not found");
  if (type === "video_render") { if (["ready_for_review", "approved", "published"].includes(video.status) && video.outputPath) return { status: "completed", message: "Render already completed" }; if (video.status !== "rendering") { const response = await queueRender(new Request("http://worker.internal", { method: "POST", headers: batchId ? { "x-batch-id": batchId } : {} }), { params: Promise.resolve({ id: String(video._id) }) }); if (!response.ok) { const body = await response.json(); throw new Error(String(body.error || "Unable to queue render")); } } return { status: "waiting_external", message: "Waiting for render worker" }; }
  if (type === "youtube_publish") {
    if (video.status !== "approved") return { status: "waiting_approval", message: "Waiting for video approval" };
    if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) return { status: "waiting_approval", message: "YouTube NOT_CONFIGURED" };
    const channel = await YouTubeChannel.findOne({ status: "connected" }).select("+accessToken +refreshToken").lean() as unknown as { _id: unknown; accessToken: string; refreshToken?: string } | null; if (!channel) return { status: "waiting_approval", message: "Connected YouTube channel required" };
    const existing = await PublishingJob.findOne({ videoId: video._id, status: "published" }); if (existing) return { status: "completed", message: "Already published" };
    const started = Date.now(); const model = llmConfig().model; await checkBudget(); const metadataAI = await aiProvider.generateMetadata({ lessonTitle: video.title, script: script as never }); const usage = (aiProvider as typeof aiProvider & { lastUsage?: { inputTokens?: number; outputTokens?: number; requestId?: string } }).lastUsage; await recordUsage({ provider: aiProvider.name, model, operation: "youtube_metadata", scriptId, requestId: usage?.requestId, inputTokens: usage?.inputTokens, outputTokens: usage?.outputTokens, durationMs: Date.now() - started });
    const metadata = { ...generateYouTubeMetadata({ lessonTitle: video.title, script: script as never }), ...metadataAI }; const publishing = await PublishingJob.create({ videoId: video._id, channelId: channel._id, title: metadata.title, description: metadata.description, tags: metadata.tags, privacyStatus: "private", status: "uploading" });
    try { const uploaded = await realYouTubeProvider(channel.accessToken, channel.refreshToken).upload(video.outputPath || "", metadata, "private"); if (!uploaded.published || !uploaded.youtubeVideoId) throw new Error(uploaded.message); publishing.status = "published"; publishing.youtubeVideoId = uploaded.youtubeVideoId; await publishing.save(); await Video.updateOne({ _id: video._id }, { status: "published" }); return { status: "completed", message: "Published privately" }; } catch (error) { publishing.status = "failed"; publishing.error = error instanceof Error ? error.message : "YouTube upload failed"; await publishing.save(); await recordFailure({ provider: "youtube", operation: "youtube_publish", durationMs: Date.now() - started, error: publishing.error }); throw error; }
  }
  if (type === "analytics_sync") throw new Error("YouTube analytics provider not configured");
  throw new Error("Unsupported job type");
}
