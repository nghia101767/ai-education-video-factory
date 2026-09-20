import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { storyboardAssetRequirements } from "@/lib/asset-management";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) { try { await connectToDatabase(); return NextResponse.json(await storyboardAssetRequirements((await params).id, true)); } catch (error) { const message = error instanceof Error ? error.message : "Asset matching failed"; return NextResponse.json({ error: message }, { status: /not found/i.test(message) ? 404 : 400 }); } }
