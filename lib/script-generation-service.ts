import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { Lesson, LessonAnalysis, Script } from "@/models";
import { connectToDatabase } from "@/lib/mongodb";
import { scriptConfig } from "@/lib/ai/config";
import { contentHash } from "@/lib/ai/cache";
import { FallbackAIProvider } from "@/lib/ai/fallback-provider";
import { OpenAILLMProvider } from "@/lib/ai/openai-provider";
import { lessonAnalysisSchema } from "@/lib/ai/analysis-schema";
import { scriptSchema, scriptFields, SCRIPT_SCHEMA_VERSION } from "@/lib/ai/script-schema";
import { SCRIPT_GENERATION_PROMPT_V2 } from "@/lib/ai/prompts/script-generation";
import { AnalysisError } from "@/lib/ai/analysis-response";
import { getPricingConfig } from "@/lib/ai/pricing";
import { checkBudget, recordCacheHit, recordFailure, recordUsage, BudgetExceededError } from "@/lib/ai/usage-service";
import type { AIProvider, LessonInput } from "@/lib/ai/types";

export type ScriptGenerationSettings = { force?: boolean; instruction?: string; analysisId?: string; style?: "clear" | "engaging" | "storytelling" };
export async function generateLessonScript(id: string, settings: ScriptGenerationSettings = {}, providerOverride?: AIProvider) {
  if (!Types.ObjectId.isValid(id)) throw new AnalysisError("INVALID_ID", "Lesson ID không hợp lệ.", 400);
  await connectToDatabase();
  const config = scriptConfig();
  if (!["mock", "openai"].includes(config.provider)) throw new AnalysisError("AI_NOT_CONFIGURED", "Script provider chưa được cấu hình.", 503);
  const provider = providerOverride || (config.provider === "openai" ? new OpenAILLMProvider() : new FallbackAIProvider());
  const started = Date.now(), token = randomUUID(), scriptId = new Types.ObjectId();
  let locked = false, recorded = 0, cacheKey = "";
  let usageSummary: Record<string, unknown> | undefined;
  try {
    const lesson = await Lesson.findById(id).populate("subjectId", "name").populate("gradeId", "name").populate("textbookId", "name");
    if (!lesson) throw new AnalysisError("LESSON_NOT_FOUND", "Không tìm thấy bài học.", 404);
    const analysis = await LessonAnalysis.findOne({ lessonId: id, ...(settings.analysisId ? { _id: settings.analysisId } : {}) }).sort({ version: -1 }).lean() as Record<string, unknown> | null;
    if (!analysis) throw new AnalysisError("ANALYSIS_REQUIRED", "Cần phân tích bài học trước khi tạo kịch bản.", 409);
    const parsedAnalysis = lessonAnalysisSchema.safeParse(Object.fromEntries(Object.keys(lessonAnalysisSchema.shape).map(key => [key, analysis[key]])));
    if (!parsedAnalysis.success) throw new AnalysisError("ANALYSIS_INVALID", "LessonAnalysis không hợp lệ. Hãy kiểm tra bước 6.", 422);
    const input: LessonInput & { analysis: typeof parsedAnalysis.data; instruction?: string; style?: string } = {
      title: lesson.title, subject: lesson.subjectId?.name || "", grade: lesson.gradeId?.name || "", textbook: lesson.textbookId?.name || "",
      analysis: parsedAnalysis.data, instruction: settings.instruction?.trim() || "", style: settings.style || "engaging",
    };
    if (JSON.stringify(input).length > 60000 || input.instruction!.length > 1000) throw new AnalysisError("SCRIPT_INPUT_TOO_LONG", "Dữ liệu kịch bản quá dài.", 422);
    const sourceDigest = contentHash(input);
    cacheKey = contentHash({ provider: provider.name, model: config.model, promptVersion: SCRIPT_GENERATION_PROMPT_V2, schemaVersion: SCRIPT_SCHEMA_VERSION, analysisHash: analysis.contentHash || contentHash(parsedAnalysis.data), sourceDigest, targetDuration: 30, style: input.style, instruction: input.instruction });
    locked = Boolean(await Lesson.findOneAndUpdate({ _id: id, $or: [{ scriptLockUntil: { $exists: false } }, { scriptLockUntil: { $lt: new Date() } }] }, { $set: { scriptLockToken: token, scriptLockUntil: new Date(Date.now() + 15 * 60000) } }));
    if (!locked) throw new AnalysisError("SCRIPT_BUSY", "Bài học đang được tạo kịch bản. Vui lòng chờ.", 409);
    const cached = settings.force ? null : await Script.findOne({ lessonId: id, analysisId: analysis._id, cacheKey, manuallyEdited: { $ne: true } }).sort({ version: -1 }).lean() as Record<string, unknown> | null;
    if (cached && scriptSchema.safeParse(scriptFields(cached)).success) {
      await recordCacheHit({ provider: provider.name, providerType: config.provider === "mock" ? "local" : "cloud", model: String(cached.model), operation: "script_generation", lessonId: id, scriptId: cached._id, cacheKey, cacheSource: "Script", durationMs: Date.now() - started });
      return { ...cached, cached: true };
    }
    const beforeAttempt = async () => {
      if (config.provider === "openai" && (Number(process.env.DAILY_AI_BUDGET || 0) > 0 || Number(process.env.MONTHLY_AI_BUDGET || 0) > 0)) {
        const rules = getPricingConfig().rules, rule = rules[`openai:${config.model}:script_generation`] || rules[`openai:${config.model}`];
        if (!rule || ![rule.inputPerMillionTokens, rule.outputPerMillionTokens, rule.cachedInputPerMillionTokens].every(value => typeof value === "number" && Number.isFinite(value) && value >= 0)) throw new AnalysisError("AI_PRICING_NOT_CONFIGURED", "Cần cấu hình đủ pricing để áp dụng ngân sách AI.", 503);
      }
      await checkBudget();
    };
    await beforeAttempt();
    const output = await provider.generateScript(input, { beforeAttempt, onAttempt: async attempt => {
      const usage = await recordUsage({ ...attempt, provider: provider.name, providerType: "cloud", operation: "script_generation", lessonId: id, scriptId, cacheKey, cached: false });
      recorded++;
      usageSummary = { ...attempt, estimatedCost: usage.estimatedCost, usageId: usage._id, inputTokens: attempt.inputTokens ?? null, outputTokens: attempt.outputTokens ?? null, cachedInputTokens: attempt.cachedInputTokens ?? null };
    } });
    const validated = scriptSchema.safeParse(output);
    if (!validated.success) throw new AnalysisError("AI_INVALID_OUTPUT", "Kịch bản AI trả về không hợp lệ.", 422);
    if (!recorded) {
      const usage = await recordUsage({ provider: provider.name, providerType: "local", model: config.model, operation: "script_generation", lessonId: id, scriptId, cacheKey, durationMs: Date.now() - started });
      recorded++;
      usageSummary = { model: config.model, inputTokens: null, outputTokens: null, estimatedCost: usage.estimatedCost, durationMs: Date.now() - started, usageId: usage._id };
    }
    if (!await Lesson.exists({ _id: id, scriptLockToken: token, scriptLockUntil: { $gt: new Date() } })) throw new AnalysisError("SCRIPT_LOCK_LOST", "Phiên tạo kịch bản đã hết hạn.", 409);
    const latest = await Script.findOne({ lessonId: id }).sort({ version: -1 }).select("version");
    const result = await Script.create({ ...validated.data, _id: scriptId, lessonId: id, analysisId: analysis._id, cacheKey, contentHash: sourceDigest,
      provider: provider.name, model: usageSummary?.model || config.model, requestedModel: config.model, promptVersion: SCRIPT_GENERATION_PROMPT_V2, schemaVersion: SCRIPT_SCHEMA_VERSION,
      usage: usageSummary, instruction: input.instruction, duration: validated.data.estimatedDuration, wordCount: validated.data.narration.split(/\s+/).length,
      status: "draft", style: input.style, version: (latest?.version || 0) + 1, validation: { valid: true, errors: [], warnings: [], schemaVersion: SCRIPT_SCHEMA_VERSION },
    });
    console.info("[Script]", { lessonId: id, scriptId: String(scriptId), provider: provider.name, model: result.model, cache: "miss", durationMs: Date.now() - started });
    return { ...result.toObject(), cached: false };
  } catch (error) {
    if (!recorded || error instanceof BudgetExceededError) await recordFailure({ provider: provider.name, model: config.model, operation: "script_generation", lessonId: id, scriptId, cacheKey, durationMs: Date.now() - started,
      status: error instanceof BudgetExceededError ? "blocked_budget" : error instanceof AnalysisError && error.code === "AI_NOT_CONFIGURED" ? "not_configured" : "failed",
      error: error instanceof AnalysisError || error instanceof BudgetExceededError ? error.message : "Script generation failed",
    }).catch(() => undefined);
    throw error;
  } finally {
    if (locked) await Lesson.updateOne({ _id: id, scriptLockToken: token }, { $unset: { scriptLockToken: "", scriptLockUntil: "" } }).catch(() => undefined);
  }
}
