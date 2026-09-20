import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Asset } from "@/models";
import { storage, type StorageFolder } from "@/lib/storage";
import { validateAssetUpload } from "@/lib/upload-validation";
import { normalizeTags, uploadVisualAsset, visualAssetTypes, type VisualAssetType } from "@/lib/asset-management";
const legacyTypes = ["audio", "video", "music", "sfx", "thumbnail"] as const;
const allTypes = [...visualAssetTypes, ...legacyTypes];
const folder: Record<typeof legacyTypes[number], StorageFolder> = { thumbnail: "thumbnails", audio: "audio", music: "audio", sfx: "audio", video: "videos" };
const escapeRegex = (value: string) => value.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
export async function GET(request: Request) {
  try { await connectToDatabase(); const url = new URL(request.url); const page = Math.max(1, Math.min(100000, Number(url.searchParams.get("page") || 1))); const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get("pageSize") || 24))); const type = url.searchParams.get("type"); const search = url.searchParams.get("search")?.trim().slice(0, 200); const tags = normalizeTags(url.searchParams.get("tags")); const query: Record<string, unknown> = {};
    if (type) { if (!allTypes.includes(type as never)) return NextResponse.json({ error: "Invalid asset type" }, { status: 400 }); query.type = type; } if (tags.length) query.tags = { $all: tags }; if (search) { const regex = { $regex: escapeRegex(search), $options: "i" }; query.$or = [{ name: regex }, { description: regex }, { filename: regex }, { prompt: regex }, { tags: regex }, { characterIdentity: regex }]; }
    const [items, total] = await Promise.all([Asset.find(query).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(), Asset.countDocuments(query)]); return NextResponse.json({ items, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } });
  } catch { return NextResponse.json({ error: "Unable to load assets" }, { status: 500 }); }
}
export async function POST(request: Request) {
  let saved: { folder: StorageFolder; filename: string } | undefined;
  try { const form = await request.formData(); const file = form.get("file"); const type = String(form.get("type") || "image"); if (!(file instanceof File) || !allTypes.includes(type as never)) return NextResponse.json({ error: "Valid file and type are required" }, { status: 400 }); await connectToDatabase();
    if (visualAssetTypes.includes(type as VisualAssetType)) { const result = await uploadVisualAsset({ file, type: type as VisualAssetType, name: String(form.get("name") || ""), description: String(form.get("description") || ""), tags: form.get("tags"), role: String(form.get("role") || ""), style: String(form.get("style") || ""), characterIdentity: String(form.get("characterIdentity") || ""), characterAppearance: String(form.get("characterAppearance") || "") }); return NextResponse.json({ ...result.asset.toObject(), reused: result.reused }, { status: result.reused ? 200 : 201 }); }
    if (file.size > 100 * 1024 * 1024) return NextResponse.json({ error: "File exceeds 100MB limit" }, { status: 413 }); const content = Buffer.from(await file.arrayBuffer()); validateAssetUpload(file.name, file.type, content, type); const hash = createHash("sha256").update(content).digest("hex"); const existing = await Asset.findOne({ hash, type, status: { $in: ["generated", "mock", "ready"] } }); if (existing) return NextResponse.json({ ...existing.toObject(), reused: true }); const filename = `${randomUUID()}${path.extname(file.name).toLowerCase()}`; await storage.save(folder[type as typeof legacyTypes[number]], filename, content); saved = { folder: folder[type as typeof legacyTypes[number]], filename }; const asset = await Asset.create({ type, name: path.basename(file.name, path.extname(file.name)), filename, storagePath: `${saved.folder}/${filename}`, mimeType: file.type, hash, size: file.size, provider: "local-upload", source: "upload", tags: normalizeTags(form.get("tags")), status: "generated", metadata: { originalName: path.basename(file.name), size: file.size } }); return NextResponse.json(asset, { status: 201 });
  } catch (error) { if (saved) await storage.delete(saved.folder, saved.filename).catch(() => undefined); return NextResponse.json({ error: error instanceof Error ? error.message : "Asset upload failed" }, { status: 400 }); }
}
