import { NextResponse } from "next/server";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { storage } from "@/lib/storage";
import { connectToDatabase } from "@/lib/mongodb";
import { Asset, Video } from "@/models";
import { validateAssetUpload } from "@/lib/upload-validation";

const folders = { image: "images", audio: "audio", video: "videos" } as const;
const maxSize = Math.max(1, Number(process.env.MAX_ASSET_SIZE || 100 * 1024 * 1024));

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let saved: { folder: keyof typeof folders; filename: string } | undefined;
  try {
    const { id } = await params;
    const form = await request.formData();
    const file = form.get("file");
    const type = String(form.get("type") || "image") as keyof typeof folders;
    if (!(file instanceof File) || !(type in folders)) return NextResponse.json({ error: "Valid file and asset type are required" }, { status: 400 });
    if (file.size > maxSize) return NextResponse.json({ error: `File exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit` }, { status: 413 });
    await connectToDatabase();
    if (!await Video.exists({ _id: id })) return NextResponse.json({ error: "Video not found" }, { status: 404 });
    const content = Buffer.from(await file.arrayBuffer());
    validateAssetUpload(file.name, file.type, content, type);
    const hash = createHash("sha256").update(content).digest("hex");
    const existing = await Asset.findOne({ type, hash, provider: "local-upload", status: "generated" }).lean();
    if (existing) return NextResponse.json({ ...existing, reused: true });
    const filename = `${randomUUID()}${path.extname(file.name).toLowerCase()}`;
    await storage.save(folders[type], filename, content);
    saved = { folder: type, filename };
    const asset = await Asset.create({ type, filename, hash, storagePath: `${folders[type]}/${filename}`, mimeType: file.type, provider: "local-upload", status: "generated", metadata: { videoId: id, originalName: path.basename(file.name), size: file.size } });
    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    if (saved) await storage.delete(folders[saved.folder], saved.filename).catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Asset upload failed" }, { status: 400 });
  }
}
