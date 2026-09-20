import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { LessonAnalysis } from "@/models";
import { analyzeLesson } from "@/lib/lesson-analysis-service";
import { AnalysisError } from "@/lib/ai/analysis-response";
import { BudgetExceededError } from "@/lib/ai/usage-service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid lesson id" }, { status: 400 });
  await connectToDatabase();
  return NextResponse.json(await LessonAnalysis.find({ lessonId: id }).sort({ version: -1 }).populate("sourceReferences", "originalName processingStatus").lean());
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid lesson id" }, { status: 400 });
  try {
    const raw = await request.text();
    let body;
    try { body = raw ? JSON.parse(raw) : {}; } catch { throw new AnalysisError("INVALID_REQUEST", "Invalid JSON body", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => key !== "force") || (body.force !== undefined && typeof body.force !== "boolean")) throw new AnalysisError("INVALID_REQUEST", "Only force:boolean is supported", 400);
    const result = await analyzeLesson(id, body.force === true);
    return NextResponse.json(result, { status: result.cached ? 200 : 201 });
  } catch (error) {
    if (error instanceof BudgetExceededError) return NextResponse.json({ error: "AI budget đã vượt giới hạn.", code: "AI_BUDGET_EXCEEDED" }, { status: 429 });
    if (error instanceof AnalysisError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    return NextResponse.json({ error: "Không thể phân tích bài học. Vui lòng thử lại.", code: "ANALYSIS_FAILED" }, { status: 502 });
  }
}
