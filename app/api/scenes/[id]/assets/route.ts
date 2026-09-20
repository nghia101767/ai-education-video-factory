import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Asset, AssetUsage, Scene } from "@/models";
import { assignAsset, unassignAsset } from "@/lib/asset-management";
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const body = await request.json(); if (!isValidObjectId(id) || !isValidObjectId(body.assetId)) return NextResponse.json({ error: "Valid scene and asset IDs are required" }, { status: 400 }); await connectToDatabase();
    if (body.requirementId) return NextResponse.json(await assignAsset({ sceneId: id, assetId: body.assetId, requirementId: String(body.requirementId), role: String(body.role || "supporting"), usageType: "matched" }));
    // Backward-compatible media mapping used by the audio/render flow.
    const [scene, asset] = await Promise.all([Scene.findById(id).populate("assetIds").lean() as any, Asset.findById(body.assetId).lean() as any]); if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 }); if (!asset || !asset.storagePath || !["generated", "mock", "ready"].includes(asset.status)) return NextResponse.json({ error: "Asset is not ready" }, { status: 409 }); const sameType = scene.assetIds.filter((item: any) => item.type === asset.type).map((item: any) => item._id); await Scene.updateOne({ _id: id }, { $pull: { assetIds: { $in: sameType } } }); await AssetUsage.deleteMany({ sceneId: id, assetId: { $in: sameType }, requirementId: { $exists: false } }); await Scene.updateOne({ _id: id }, { $addToSet: { assetIds: asset._id } }); await AssetUsage.findOneAndUpdate({ assetId: asset._id, sceneId: id, requirementId: { $exists: false } }, { usageType: "matched" }, { upsert: true, new: true }); return NextResponse.json(await Scene.findById(id).populate("assetIds").lean());
  } catch (error) { const message = error instanceof Error ? error.message : "Asset mapping failed"; return NextResponse.json({ error: message }, { status: /not found/i.test(message) ? 404 : 400 }); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const body = await request.json(); await connectToDatabase(); if (body.requirementId) return NextResponse.json(await unassignAsset({ sceneId: id, requirementId: String(body.requirementId) })); if (!isValidObjectId(body.assetId)) return NextResponse.json({ error: "Valid assetId or requirementId is required" }, { status: 400 }); const scene = await Scene.findOneAndUpdate({ _id: id, assetIds: body.assetId }, { $pull: { assetIds: body.assetId } }, { new: true }).lean(); if (!scene) return NextResponse.json({ error: "Scene or assignment not found" }, { status: 404 }); await AssetUsage.deleteMany({ assetId: body.assetId, sceneId: id, requirementId: { $exists: false } }); return NextResponse.json(scene);
  } catch (error) { const message = error instanceof Error ? error.message : "Asset unmapping failed"; return NextResponse.json({ error: message }, { status: /not found/i.test(message) ? 404 : 400 }); }
}
