import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { PublishingJob, Video, YouTubeChannel } from "@/models";
import { generateYouTubeMetadata, MockYouTubeProvider, realYouTubeProvider } from "@/lib/youtube";
import { isMockAI } from "@/lib/ai/config";

type VideoRecord = { _id: unknown; title: string; status: string; outputPath?: string };
const allowedPrivacy = new Set(["private", "unlisted", "public"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const privacyStatus = String(body.privacyStatus || "private");
    if (!allowedPrivacy.has(privacyStatus)) return NextResponse.json({ error: "Invalid privacy status" }, { status: 400 });
    if (privacyStatus === "public" && body.confirmPublic !== true) return NextResponse.json({ error: "Public upload requires explicit confirmation" }, { status: 400 });
    await connectToDatabase();
    const video = await Video.findById(id).lean() as unknown as VideoRecord | null;
    if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });
    if (video.status !== "approved") return NextResponse.json({ error: "Only approved videos can be published" }, { status: 403 });
    if (!video.outputPath) return NextResponse.json({ error: "Rendered video file is required" }, { status: 409 });
    const metadata = generateYouTubeMetadata({ lessonTitle: video.title });
    const mode = isMockAI() || (process.env.YOUTUBE_PROVIDER || "mock").toLowerCase() === "mock" ? "mock" : "real";
    if (mode === "mock") {
      const result = await new MockYouTubeProvider().upload(video.outputPath, metadata, privacyStatus);
      return NextResponse.json({ mode: "mock", status: "mock_completed", published: false, privacyStatus, message: `MOCK: ${result.message}` });
    }
    if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET || !process.env.YOUTUBE_CREDENTIAL_KEY) return NextResponse.json({ code: "NOT_CONFIGURED", error: "YouTube credentials are NOT_CONFIGURED" }, { status: 503 });
    const channel = await YouTubeChannel.findOne({ _id: body.channelId, status: "connected" }).select("+accessToken +refreshToken").lean() as unknown as { _id: unknown; accessToken?: string; refreshToken?: string } | null;
    if (!channel?.accessToken) return NextResponse.json({ error: "Connected channel is required" }, { status: 403 });
    const requestedMetadata = { ...metadata, title: String(body.title || metadata.title).trim().slice(0, 100), description: String(body.description || metadata.description).trim().slice(0, 5000), tags: Array.isArray(body.tags) ? body.tags.map((value: unknown) => String(value).trim()).filter(Boolean).slice(0, 50) : metadata.tags };
    if (!requestedMetadata.title) return NextResponse.json({ error: "YouTube title is required" }, { status: 400 });
    const publishing = await PublishingJob.create({ videoId: id, channelId: channel._id, title: requestedMetadata.title, description: requestedMetadata.description, tags: requestedMetadata.tags, privacyStatus, status: "uploading" });
    try {
      const result = await realYouTubeProvider(channel.accessToken, channel.refreshToken).upload(video.outputPath, requestedMetadata, privacyStatus);
      publishing.status = "published"; publishing.youtubeVideoId = result.youtubeVideoId; await publishing.save();
      await Video.updateOne({ _id: id }, { status: "published" });
      return NextResponse.json({ job: publishing, mode: "real", published: true, message: result.message });
    } catch (error) {
      const message = error instanceof Error ? error.message : "YouTube upload failed"; publishing.status = /quota/i.test(message) ? "quota_exceeded" : /authentication/i.test(message) ? "authentication_required" : "failed"; publishing.error = message; await publishing.save(); throw error;
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to publish" }, { status: 502 });
  }
}
