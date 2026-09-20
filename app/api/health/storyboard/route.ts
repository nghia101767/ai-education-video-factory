import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { storyboardConfig } from "@/lib/ai/config";
import { Storyboard } from "@/models";
import { STORYBOARD_GENERATION_PROMPT_V1 } from "@/lib/ai/prompts/storyboard-generation";
import { STORYBOARD_SCHEMA_VERSION } from "@/lib/ai/storyboard-schema";
export async function GET() { const config = storyboardConfig(); await connectToDatabase(); const runtimeVerified = config.provider === "openai" && Boolean(await Storyboard.exists({ provider: "openai", requestedModel: config.model, promptVersion: STORYBOARD_GENERATION_PROMPT_V1, schemaVersion: STORYBOARD_SCHEMA_VERSION })); return NextResponse.json({ provider: config.provider, model: config.model, configured: config.provider === "mock" || Boolean(process.env.OPENAI_API_KEY?.trim()), runtimeVerified }); }
