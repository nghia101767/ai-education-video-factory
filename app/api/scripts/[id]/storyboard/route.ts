import { NextResponse } from "next/server";
import { z } from "zod";
import { AnalysisError } from "@/lib/ai/analysis-response";
import { BudgetExceededError } from "@/lib/ai/usage-service";
import { generateScriptStoryboard, getCurrentStoryboard } from "@/lib/storyboard-generation-service";

const requestSchema = z.strictObject({ force: z.boolean().optional(), instruction: z.string().trim().max(1000).optional() });
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const item = await getCurrentStoryboard((await params).id); return item ? NextResponse.json(item) : NextResponse.json({ error: "Chưa có Storyboard." }, { status: 404 }); }
  catch { return NextResponse.json({ error: "Không thể tải Storyboard." }, { status: 500 }); }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const text = await request.text(); if (text.length > 10000) return NextResponse.json({ error: "Request quá dài." }, { status: 413 });
    const input = requestSchema.safeParse(text ? JSON.parse(text) : {}); if (!input.success) return NextResponse.json({ error: "Yêu cầu tạo Storyboard không hợp lệ." }, { status: 400 });
    const item = await generateScriptStoryboard((await params).id, input.data);
    return NextResponse.json(item, { status: item.cached ? 200 : 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "JSON không hợp lệ." }, { status: 400 });
    const status = error instanceof BudgetExceededError ? 429 : error instanceof AnalysisError ? error.httpStatus : 500;
    return NextResponse.json({ error: error instanceof BudgetExceededError ? "Đã vượt ngân sách AI." : error instanceof AnalysisError ? error.message : "Không thể tạo Storyboard.", code: error instanceof BudgetExceededError ? error.code : error instanceof AnalysisError ? error.code : "STORYBOARD_GENERATION_FAILED" }, { status });
  }
}
