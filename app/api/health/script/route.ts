import { NextResponse } from "next/server";
import { scriptConfig } from "@/lib/ai/config";
import { SCRIPT_GENERATION_PROMPT_V2 } from "@/lib/ai/prompts/script-generation";
import { SCRIPT_SCHEMA_VERSION } from "@/lib/ai/script-schema";
import { Script } from "@/models";
import { connectToDatabase } from "@/lib/mongodb";
export async function GET() {
  const { provider, model } = scriptConfig();
  const configured = provider === "mock" || (provider === "openai" && Boolean(process.env.OPENAI_API_KEY?.trim()));
  await connectToDatabase();
  const runtimeVerified = provider === "openai" && Boolean(await Script.exists({ provider, requestedModel: model, promptVersion: SCRIPT_GENERATION_PROMPT_V2, schemaVersion: SCRIPT_SCHEMA_VERSION }));
  return NextResponse.json({ provider, model, configured, runtimeVerified, promptVersion: SCRIPT_GENERATION_PROMPT_V2, schemaVersion: SCRIPT_SCHEMA_VERSION });
}
