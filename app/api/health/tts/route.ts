import { NextResponse } from "next/server";
import { ttsConfig } from "@/lib/ai/config";
import { vieneuClient, type VieNeuHealth } from "@/lib/ai/vieneu-client";
export async function GET() {
  const config = ttsConfig();
  if (config.provider !== "vieneu") return NextResponse.json({ provider: config.provider, model: config.model, available: config.provider === "mock" || Boolean(process.env.OPENAI_API_KEY), voices: [{ id: config.voice, label: config.voice }] });
  try { return NextResponse.json(await vieneuClient.request<VieNeuHealth>({ operation: "health" })); }
  catch { return NextResponse.json({ provider: "vieneu", model: config.model, backend: "onnx", available: false, error: "VIENEU_NOT_AVAILABLE" }, { status: 503 }); }
}
