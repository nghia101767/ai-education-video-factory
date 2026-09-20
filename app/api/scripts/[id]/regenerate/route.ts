import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/mongodb";
import { Script } from "@/models";
import { generateLessonScript } from "@/lib/script-generation-service";
import { AnalysisError } from "@/lib/ai/analysis-response";
import { BudgetExceededError } from "@/lib/ai/usage-service";

const inputSchema = z.strictObject({ instruction: z.string().trim().max(1000).optional(), style: z.enum(["clear", "engaging", "storytelling"]).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Script ID không hợp lệ." }, { status: 400 });
  try {
    const text = await request.text();
    if (text.length > 10000) return NextResponse.json({ error: "Request quá dài." }, { status: 413 });
    const input = inputSchema.safeParse(text ? JSON.parse(text) : {});
    if (!input.success) return NextResponse.json({ error: "Yêu cầu tạo lại kịch bản không hợp lệ." }, { status: 400 });
    await connectToDatabase();
    const current = await Script.findById(id).select("lessonId analysisId style").lean() as unknown as { lessonId: unknown; analysisId: unknown; style?: "clear" | "engaging" | "storytelling" } | null;
    if (!current) return NextResponse.json({ error: "Script not found" }, { status: 404 });
    const result = await generateLessonScript(String(current.lessonId), { force: true, analysisId: String(current.analysisId), style: input.data.style || current.style || "engaging", instruction: input.data.instruction });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "JSON không hợp lệ." }, { status: 400 });
    const status = error instanceof BudgetExceededError ? 429 : error instanceof AnalysisError ? error.httpStatus : 500;
    const code = error instanceof BudgetExceededError ? "blocked_budget" : error instanceof AnalysisError ? error.code : "SCRIPT_GENERATION_FAILED";
    return NextResponse.json({ error: error instanceof BudgetExceededError ? "Đã vượt ngân sách AI." : error instanceof AnalysisError ? error.message : "Không thể tạo lại kịch bản.", code }, { status });
  }
}
