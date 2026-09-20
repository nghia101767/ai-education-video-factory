import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Asset, CharacterProfile } from "@/models";

const clean = (value: unknown, max = 1000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const escapeRegex = (value: string) => value.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
export async function GET(request: Request) {
  await connectToDatabase(); const url = new URL(request.url); const search = clean(url.searchParams.get("search"), 100); const status = url.searchParams.get("status");
  const query: Record<string, unknown> = {}; if (search) query.name = { $regex: escapeRegex(search), $options: "i" }; if (["active", "archived"].includes(status || "")) query.status = status;
  return NextResponse.json(await CharacterProfile.find(query).populate("referenceAssets", "filename storagePath mimeType type").sort({ createdAt: -1 }).limit(100).lean());
}
export async function POST(request: Request) {
  try { const body = await request.json(); const name = clean(body.name, 120); if (!name) return NextResponse.json({ error: "Character name is required" }, { status: 400 });
    const referenceAssets = Array.isArray(body.referenceAssets) ? body.referenceAssets.filter((id: unknown) => typeof id === "string" && isValidObjectId(id)).slice(0, 10) : [];
    await connectToDatabase(); if (referenceAssets.length !== await Asset.countDocuments({ _id: { $in: referenceAssets }, type: "image" })) return NextResponse.json({ error: "Every reference must be an existing image asset" }, { status: 400 });
    const item = await CharacterProfile.create({ name, description: clean(body.description), appearance: clean(body.appearance), personality: clean(body.personality), visualStyle: clean(body.visualStyle, 300), tags: clean(body.tags, 300).split(",").map((v) => v.trim()).filter(Boolean), status: body.status === "archived" ? "archived" : "active", referenceAssets }); return NextResponse.json(item, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create character" }, { status: 400 }); }
}
