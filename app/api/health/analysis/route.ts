import { NextResponse } from "next/server";
import { analysisConfig } from "@/lib/ai/config";
import { LESSON_ANALYSIS_PROMPT_VERSION } from "@/lib/ai/prompts/lesson-analysis";
import { ANALYSIS_SCHEMA_VERSION } from "@/lib/ai/analysis-schema";
import { LessonAnalysis } from "@/models";
import { connectToDatabase } from "@/lib/mongodb";
export async function GET() {
  const { provider, model } = analysisConfig();
  const configured = provider === "mock" || (provider === "openai" && Boolean(process.env.OPENAI_API_KEY?.trim()));
  await connectToDatabase();
  const runtimeVerified = provider === "openai" && Boolean(await LessonAnalysis.exists({ provider, requestedModel: model, schemaVersion: ANALYSIS_SCHEMA_VERSION, promptVersion: LESSON_ANALYSIS_PROMPT_VERSION }));
  return NextResponse.json({ provider, model, configured, runtimeVerified, promptVersion: LESSON_ANALYSIS_PROMPT_VERSION, schemaVersion: ANALYSIS_SCHEMA_VERSION });
}
