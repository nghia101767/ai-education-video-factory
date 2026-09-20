import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { BudgetExceededError } from "@/lib/ai/usage-service";
import { ImageProviderError } from "@/lib/ai/image-provider";
import { generateRequirementAsset } from "@/lib/asset-management";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const body = await request.json();
    if (!body.sceneId || !body.requirementId) return NextResponse.json({ error: "sceneId and requirementId are required" }, { status: 400 });
    await connectToDatabase();
    const result = await generateRequirementAsset({ storyboardId: id, sceneId: String(body.sceneId), requirementId: String(body.requirementId), settings: body.settings && typeof body.settings === "object" ? body.settings : {} });
    return NextResponse.json(result, { status: result.reused ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed";
    const code = error instanceof BudgetExceededError ? "BUDGET_EXCEEDED" : error instanceof ImageProviderError ? error.code : (error as { code?: string }).code || "PROVIDER_ERROR";
    const status = error instanceof BudgetExceededError ? 429 : error instanceof ImageProviderError ? error.httpStatus : /not found/i.test(message) ? 404 : 502;
    return NextResponse.json({ error: message, code }, { status });
  }
}
