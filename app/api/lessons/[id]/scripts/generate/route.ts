import { NextResponse } from "next/server";
import { z } from "zod";
import { generateLessonScript } from "@/lib/script-generation-service";
import { AnalysisError } from "@/lib/ai/analysis-response";
import { BudgetExceededError } from "@/lib/ai/usage-service";
const requestSchema = z.strictObject({ force: z.boolean().optional(), instruction: z.string().trim().max(1000).optional(), style: z.enum(["clear", "engaging", "storytelling"]).optional(), analysisId: z.string().regex(/^[a-f\d]{24}$/i).optional() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const text = await request.text();
    if (text.length > 10000) return NextResponse.json({ error: "Request quá dài." }, { status: 413 });
    const input = requestSchema.safeParse(text ? JSON.parse(text) : {});
    if (!input.success) return NextResponse.json({ error: "Yêu cầu tạo kịch bản không hợp lệ." }, { status: 400 });
    const result = await generateLessonScript(id, input.data);
    return NextResponse.json(result, { status: result.cached ? 200 : 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "JSON không hợp lệ." }, { status: 400 });
    const status = error instanceof BudgetExceededError ? 429 : error instanceof AnalysisError ? error.httpStatus : 500;
    const code = error instanceof BudgetExceededError ? "blocked_budget" : error instanceof AnalysisError ? error.code : "SCRIPT_GENERATION_FAILED";
    console.error("[Script]", { lessonId: id, code });
    return NextResponse.json({ error: error instanceof BudgetExceededError ? "Đã vượt ngân sách AI." : error instanceof AnalysisError ? error.message : "Không thể tạo kịch bản.", code }, { status });
  }
}
