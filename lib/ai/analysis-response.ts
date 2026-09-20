import OpenAI from "openai";
import type { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { lessonAnalysisSchema } from "@/lib/ai/analysis-schema";
import { analysisConfig } from "@/lib/ai/config";
import { LESSON_ANALYSIS_SYSTEM, lessonAnalysisPrompt } from "@/lib/ai/prompts/lesson-analysis";
import type { AnalysisAttempt, AnalysisOptions, LessonInput } from "@/lib/ai/types";

export class AnalysisError extends Error {
  constructor(public code: string, message: string, public httpStatus = 502, public retryable = false) { super(message); }
}
export function classifyAnalysisError(error: unknown): AnalysisError {
  if (error instanceof AnalysisError) return error;
  if (error instanceof OpenAI.APIConnectionTimeoutError) return new AnalysisError("AI_TIMEOUT", "OpenAI request timeout. Vui lòng thử lại.", 504, true);
  if (error instanceof OpenAI.APIConnectionError) return new AnalysisError("AI_NETWORK_ERROR", "Không thể kết nối OpenAI.", 502, true);
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401 || error.status === 403) return new AnalysisError("AI_AUTHENTICATION_FAILED", "OpenAI API key không hợp lệ hoặc không có quyền truy cập.", 503);
    if (error.status === 429 && error.code === "insufficient_quota") return new AnalysisError("AI_QUOTA_EXCEEDED", "Tài khoản OpenAI đã hết quota.", 503);
    if (error.status === 429 || error.status === 408 || (error.status || 0) >= 500) return new AnalysisError("AI_TEMPORARY_ERROR", "OpenAI tạm thời không khả dụng. Vui lòng thử lại.", 503, true);
    return new AnalysisError("AI_INVALID_REQUEST", "OpenAI từ chối request. Kiểm tra model, quyền truy cập và schema.", 502);
  }
  return new AnalysisError("ANALYSIS_FAILED", "Không thể phân tích bài học.");
}
export function retryDelay(error: unknown, attempt: number, base: number) {
  const value = error instanceof OpenAI.APIError ? error.headers?.get("retry-after") : null;
  const parsed = value ? (/^\d+(\.\d+)?$/.test(value) ? Number(value) * 1000 : Date.parse(value) - Date.now()) : NaN;
  // A larger server delay is reported to the caller instead of retrying too early.
  return Number.isFinite(parsed) ? Math.max(0, parsed) : Math.min(30000, base * 2 ** attempt);
}

export async function requestAnalysis(input: LessonInput, options: AnalysisOptions = {}) {
  return requestSchemaResponse({ config: analysisConfig(), system: LESSON_ANALYSIS_SYSTEM, prompt: lessonAnalysisPrompt(input), schema: lessonAnalysisSchema, name: "lesson_analysis" }, options);
}

// Shared official transport; analysis retains its original request and retry policy.
export async function requestSchemaResponse<T>(request: { config: ReturnType<typeof analysisConfig>; system: string; prompt: string; schema: z.ZodType<T>; name: string; invalidMessage?: string }, options: AnalysisOptions = {}): Promise<T> {
  const { config } = request;
  if (!process.env.OPENAI_API_KEY?.trim()) throw new AnalysisError("AI_NOT_CONFIGURED", "OpenAI chưa được cấu hình. Thiếu OPENAI_API_KEY.", 503);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL || undefined, timeout: Math.min(120000, config.timeoutMs), maxRetries: 0 });
  for (let attempt = 0; attempt <= Math.min(config.retryLimit, 3); attempt++) {
    await options.beforeAttempt?.();
    const started = Date.now();
    const usage: AnalysisAttempt = { model: config.model, durationMs: 0, status: "failed" };
    let output;
    let failure: unknown;
    try {
      // Strict schema at the API boundary; validate independently before persistence.
      // create() preserves usage even when output fails validation/refuses.
      const response = await client.responses.create({ model: config.model, store: false, max_output_tokens: 8000,
        input: [{ role: "system", content: request.system }, { role: "user", content: request.prompt }],
        text: { format: zodTextFormat(request.schema, request.name) },
      });
      usage.model = response.model;
      usage.requestId = response._request_id || response.id;
      usage.inputTokens = response.usage?.input_tokens;
      usage.outputTokens = response.usage?.output_tokens;
      usage.cachedInputTokens = response.usage?.input_tokens_details?.cached_tokens;
      if (response.output.some(item => item.type === "message" && item.content.some(part => part.type === "refusal"))) throw new AnalysisError("AI_REFUSAL", "OpenAI từ chối phân tích nội dung này.");
      if (response.status !== "completed") throw new AnalysisError("AI_INCOMPLETE_OUTPUT", "OpenAI chưa trả kết quả đầy đủ. Hãy giảm độ dài nội dung.", 502, true);
      try { output = request.schema.parse(JSON.parse(response.output_text)); }
      catch { throw new AnalysisError("AI_INVALID_OUTPUT", request.invalidMessage || "AI output failed schema validation.", 502, true); }
      usage.status = "success";
    } catch (error) { failure = error; usage.error = classifyAnalysisError(error).message; }
    usage.durationMs = Date.now() - started;
    // Accounting failure must not repeat an already successful paid request.
    await options.onAttempt?.(usage);
    if (output) return output;
    const safe = classifyAnalysisError(failure);
    const delay = retryDelay(failure, attempt, config.retryBaseMs);
    if (!safe.retryable || attempt >= Math.min(config.retryLimit, 3) || delay > 60000) throw safe;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw new AnalysisError("ANALYSIS_FAILED", "Không thể phân tích bài học.");
}
