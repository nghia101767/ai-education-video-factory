import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { storyboardAssetRequirements } from "@/lib/asset-management";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) { try { await connectToDatabase(); const { id } = await params; const matches = new URL(request.url).searchParams.get("matches") === "true"; return NextResponse.json(await storyboardAssetRequirements(id, matches)); } catch (error) { const message = error instanceof Error ? error.message : "Unable to load storyboard assets"; return NextResponse.json({ error: message }, { status: /not found/i.test(message) ? 404 : 400 }); } }
