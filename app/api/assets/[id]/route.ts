import path from "node:path";
import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Asset, AssetUsage, Scene } from "@/models";
import { storage, type StorageFolder } from "@/lib/storage";
import { normalizeTags } from "@/lib/asset-management";
const text = (value: unknown, max: number) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; if (!isValidObjectId(id)) return NextResponse.json({ error: "Invalid asset id" }, { status: 400 }); const body = await request.json() as Record<string, unknown>; const allowed = new Set(["name", "description", "tags", "role", "style", "characterIdentity", "characterAppearance"]); if (Object.keys(body).some(key => !allowed.has(key))) return NextResponse.json({ error: "Unsupported metadata field" }, { status: 400 }); const patch: Record<string, unknown> = {}; for (const key of ["name", "description", "role", "style", "characterIdentity", "characterAppearance"]) if (key in body) patch[key] = text(body[key], key === "description" || key === "characterAppearance" ? 2000 : 200); if ("tags" in body) patch.tags = normalizeTags(body.tags); await connectToDatabase(); const asset = await Asset.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true }).lean(); return asset ? NextResponse.json(asset) : NextResponse.json({ error: "Asset not found" }, { status: 404 }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Asset update failed" }, { status: 400 }); }
}
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!isValidObjectId(id)) return NextResponse.json({ error: "Invalid asset id" }, { status: 400 }); await connectToDatabase(); const asset = await Asset.findById(id).lean() as { _id: unknown; storagePath?: string } | null; if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 }); if (await AssetUsage.exists({ assetId: asset._id }) || await Scene.exists({ $or: [{ assetIds: asset._id }, { "assetMappings.assetId": asset._id }] })) return NextResponse.json({ error: "Asset is in use and cannot be deleted" }, { status: 409 }); await Asset.deleteOne({ _id: asset._id }); if (asset.storagePath) { const [directory, ...parts] = asset.storagePath.split("/"); const allowed = new Set(["images", "audio", "videos", "thumbnails"]); if (allowed.has(directory) && parts.length) await storage.delete(directory as StorageFolder, path.join(...parts)).catch(() => undefined); } return NextResponse.json({ deleted: true });
}
