import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Job, RenderJob, Scene, SystemSetting, Video } from "@/models";

type Asset = { type: string; storagePath?: string; status: string; provider?: string; metadata?: { inputText?: string } };
type SceneRecord = { _id: unknown; sceneNumber: number; startTime: number; endTime: number; duration: number; narration: string; subtitleText?: string; assetIds: Asset[] };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const video = await Video.findById(id).populate("backgroundMusicAssetId").lean() as unknown as { _id: unknown; scriptId?: unknown; status: string; backgroundMusicAssetId?: Asset } | null;
    if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });
    if (!video.scriptId) return NextResponse.json({ error: "Video has no script" }, { status: 409 });
    if (await RenderJob.exists({ videoId: id, status: { $in: ["queued", "processing"] } })) return NextResponse.json({ error: "Video already has an active render job" }, { status: 409 });
    if (await Job.exists({ type: "tts_generation", "payload.scriptId": String(video.scriptId), status: { $in: ["queued", "processing", "cancellation_requested"] } })) return NextResponse.json({ error: "TTS is still generating" }, { status: 409 });
    const latestTTS = await Job.findOne({ type: "tts_generation", "payload.scriptId": String(video.scriptId) }).sort({ createdAt: -1 }).select("status");
    if (latestTTS && latestTTS.status !== "completed") return NextResponse.json({ error: "Complete TTS generation before rendering" }, { status: 409 });
    const scenes = await Scene.find({ scriptId: video.scriptId }).sort({ sceneNumber: 1 }).populate("assetIds").lean() as unknown as SceneRecord[];
    if (scenes.length < 5 || scenes.length > 7) return NextResponse.json({ error: "Storyboard must contain 5–7 scenes" }, { status: 409 });
    const inputAssets = scenes.map((scene) => {
      const image = scene.assetIds.find((asset) => asset.type === "image" && asset.storagePath && ["generated", "mock"].includes(asset.status));
      const audio = scene.assetIds.find((asset) => asset.type === "audio" && asset.storagePath && ["generated", "mock"].includes(asset.status));
      const sfx = scene.assetIds.find((asset) => asset.type === "sfx" && asset.storagePath && ["generated", "mock"].includes(asset.status));
      if (!image || !audio) throw new Error(`Scene ${scene.sceneNumber} requires an image and voice asset`);
      if (audio.provider === "vieneu" && audio.metadata?.inputText !== scene.narration) throw new Error(`Scene ${scene.sceneNumber} narration changed; regenerate voice`);
      return { sceneId: scene._id, sceneNumber: scene.sceneNumber, startTime: scene.startTime, endTime: scene.endTime, duration: scene.duration, subtitleText: scene.subtitleText || scene.narration, imagePath: image.storagePath, audioPath: audio.storagePath, audioProvider: audio.provider, sfxPath: sfx?.storagePath };
    });
    const duration = inputAssets.reduce((sum, scene) => sum + scene.duration, 0);
    if (!inputAssets.every(scene => scene.audioProvider === "vieneu") && (duration < 25 || duration > 35)) return NextResponse.json({ error: "Total scene duration must be 25–35 seconds" }, { status: 422 });
    const setting = await SystemSetting.findOne({ key: "application" }).lean() as unknown as { value?: { render?: { width?: number; height?: number; fps?: number; subtitleMargin?: number } } } | null;
    const stored = setting?.value?.render; const renderSettings = { width: Number(stored?.width || 1080), height: Number(stored?.height || 1920), fps: Number(stored?.fps || 30), subtitleMargin: Number(stored?.subtitleMargin || 300) };
    const backgroundMusicPath = video.backgroundMusicAssetId?.storagePath && ["generated", "mock"].includes(video.backgroundMusicAssetId.status) ? video.backgroundMusicAssetId.storagePath : undefined;
    const job = await RenderJob.create({ videoId: id, batchId: request.headers.get("x-batch-id") || undefined, status: "queued", currentStep: "Queued", inputAssets, renderSettings: { ...renderSettings, backgroundMusicPath } });
    await Video.findByIdAndUpdate(id, { status: "rendering", width: renderSettings.width, height: renderSettings.height, fps: renderSettings.fps });
    return NextResponse.json(job, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to queue render" }, { status: 400 });
  }
}
