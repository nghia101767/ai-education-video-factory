import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { PublishingJob, RenderJob, Video, VideoAnalytics, YouTubeChannel } from "@/models";
import { decryptCredential } from "@/lib/credentials";
import { isMockAI } from "@/lib/ai/config";

export async function GET() { await connectToDatabase(); const [snapshots, videos, renders, publishing] = await Promise.all([VideoAnalytics.find().sort({ fetchedAt: -1 }).limit(100).populate("videoId", "title").lean(), Video.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]), RenderJob.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]), PublishingJob.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }])]); const map = (rows: Array<{ _id: string; count: number }>) => Object.fromEntries(rows.map((row) => [row._id, row.count])); return NextResponse.json({ mode: isMockAI() || (process.env.YOUTUBE_PROVIDER || "mock") === "mock" ? "mock" : "real", summary: { videos: map(videos), renders: map(renders), publishing: map(publishing) }, snapshots }); }
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})); const mode = isMockAI() || (process.env.YOUTUBE_PROVIDER || "mock") === "mock" ? "mock" : "real";
    if (mode === "mock") return NextResponse.json({ mode: "mock", persisted: false, message: "MOCK analytics preview only; no production analytics record was stored.", preview: { views: 0, likes: 0, comments: 0 } });
    if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET || !process.env.YOUTUBE_CREDENTIAL_KEY) return NextResponse.json({ code: "NOT_CONFIGURED", error: "YouTube analytics is NOT_CONFIGURED" }, { status: 503 });
    await connectToDatabase(); const channel = await YouTubeChannel.findOne({ _id: body.channelId, status: "connected" }).select("+accessToken").lean() as unknown as { _id: unknown; accessToken?: string } | null;
    if (!channel?.accessToken) return NextResponse.json({ error: "Connected channel is required" }, { status: 403 });
    const publishing = await PublishingJob.find({ channelId: channel._id, status: "published", youtubeVideoId: { $exists: true, $ne: "" } }).limit(50).lean() as unknown as Array<{ videoId: unknown; youtubeVideoId: string }>;
    if (!publishing.length) return NextResponse.json({ mode: "real", synced: 0, message: "No published videos to sync" });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${publishing.map((job) => encodeURIComponent(job.youtubeVideoId)).join(",")}`, { headers: { Authorization: `Bearer ${decryptCredential(channel.accessToken)}` } });
    if (!response.ok) return NextResponse.json({ error: `YouTube analytics request failed (${response.status})` }, { status: response.status === 401 ? 401 : 502 });
    const payload = await response.json() as { items?: Array<{ id: string; statistics?: Record<string, string> }> }; const map = new Map(publishing.map((job) => [job.youtubeVideoId, job])); const snapshots = [];
    for (const item of payload.items || []) { const job = map.get(item.id); if (!job) continue; const stats = item.statistics || {}; snapshots.push(await VideoAnalytics.create({ videoId: job.videoId, youtubeVideoId: item.id, views: Number(stats.viewCount || 0), likes: Number(stats.likeCount || 0), comments: Number(stats.commentCount || 0), fetchedAt: new Date() })); }
    return NextResponse.json({ mode: "real", synced: snapshots.length, snapshots });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Analytics sync failed" }, { status: 502 }); }
}
