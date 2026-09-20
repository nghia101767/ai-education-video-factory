import { NextResponse } from "next/server";
import { availableImageProviders, imageProviderStatus } from "@/lib/ai/image-provider";
import { loadImageSettings, saveImageSettings } from "@/lib/ai/image-settings";

export async function GET() {
  try { const current = await loadImageSettings(); return NextResponse.json({ image: imageProviderStatus(current.provider, current.model), availableProviders: availableImageProviders() }); }
  catch { return NextResponse.json({ error: "Unable to load AI provider settings" }, { status: 500 }); }
}
export async function PATCH(request: Request) {
  try { const body = await request.json(); const current = await saveImageSettings({ provider: body?.provider, model: body?.model }); return NextResponse.json({ image: imageProviderStatus(current.provider, current.model), availableProviders: availableImageProviders() }); }
  catch (error) { const code = error instanceof Error ? error.message : "INVALID_SETTINGS"; return NextResponse.json({ error: code === "INVALID_IMAGE_PROVIDER" ? "Unsupported image provider" : code === "INVALID_IMAGE_MODEL" ? "Invalid image model" : "Unable to save AI provider settings", code }, { status: 400 }); }
}
