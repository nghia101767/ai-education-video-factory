import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { generateSceneImageAsset } from "@/lib/asset-management";
import { BudgetExceededError } from "@/lib/ai/usage-service";
import { ImageProviderError } from "@/lib/ai/image-provider";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; await connectToDatabase(); const asset = await generateSceneImageAsset(id); return NextResponse.json(asset, { status: asset.reused ? 200 : 201 }); }
  catch (error) { const code = error instanceof BudgetExceededError ? "BUDGET_EXCEEDED" : error instanceof ImageProviderError ? error.code : "PROVIDER_ERROR"; const status = error instanceof BudgetExceededError ? 429 : error instanceof ImageProviderError ? error.httpStatus : /not found/i.test(error instanceof Error ? error.message : "") ? 404 : 502; return NextResponse.json({ error: error instanceof Error ? error.message : "Asset generation failed", code }, { status }); }
}
