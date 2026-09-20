import { randomUUID } from "node:crypto";
import { Lesson, LessonAnalysis, SourceDocument } from "@/models";
import { connectToDatabase } from "@/lib/mongodb";
import { analysisConfig } from "@/lib/ai/config";
import { contentHash } from "@/lib/ai/cache";
import { FallbackAIProvider } from "@/lib/ai/fallback-provider";
import { OpenAILLMProvider } from "@/lib/ai/openai-provider";
import { lessonAnalysisSchema, ANALYSIS_SCHEMA_VERSION } from "@/lib/ai/analysis-schema";
import { LESSON_ANALYSIS_PROMPT_VERSION } from "@/lib/ai/prompts/lesson-analysis";
import { normalizeLessonText, validateAnalysisSize } from "@/lib/ai/analysis-input";
import { AnalysisError } from "@/lib/ai/analysis-response";
import { getPricingConfig } from "@/lib/ai/pricing";
import { checkBudget, recordCacheHit, recordFailure, recordUsage, BudgetExceededError } from "@/lib/ai/usage-service";
import type { AIProvider, LessonInput } from "@/lib/ai/types";

// Shared by HTTP and the existing worker; each call owns its provider/accounting.
export async function analyzeLesson(id: string, force = false, providerOverride?: AIProvider) {
  await connectToDatabase();
  const config = analysisConfig();
  if (!["mock", "openai"].includes(config.provider)) throw new AnalysisError("AI_NOT_CONFIGURED", "Analysis provider không được hỗ trợ.", 503);
  const provider = providerOverride || (config.provider === "openai" ? new OpenAILLMProvider() : new FallbackAIProvider());
  const started = Date.now(); const token = randomUUID();
  let locked = false; let attemptsRecorded = 0; let cacheKey = "";
  let usageSummary: Record<string, unknown> | undefined;
  try {
    const lesson = await Lesson.findById(id).populate("subjectId", "name").populate("gradeId", "name").populate("textbookId", "name");
    if (!lesson) throw new AnalysisError("LESSON_NOT_FOUND", "Không tìm thấy bài học.", 404);
    const documents = await SourceDocument.find({ $or: [{ _id: { $in: lesson.sourceDocumentIds || [] } }, { lessonId: id }] }).select("+extractedText").sort({ _id: 1 });
    if (documents.some(doc => doc.processingStatus !== "READY" || !doc.extractedText?.trim() || (config.provider === "openai" && (doc.metadata?.mock || doc.metadata?.provider?.startsWith("mock") || doc.extractedText.startsWith("MOCK"))))) {
      throw new AnalysisError("ANALYSIS_UNAVAILABLE", "Tài liệu nguồn chưa trích xuất xong, OCR chưa cấu hình hoặc chỉ có MOCK OCR. Hãy xử lý nguồn trước khi phân tích.", 409);
    }
    const input: LessonInput = {
      title: normalizeLessonText(lesson.title), summary: normalizeLessonText([lesson.summary, ...documents.map(doc => doc.extractedText)].filter(Boolean).join("\n\n")),
      objectives: (lesson.objectives || []).map(normalizeLessonText).filter(Boolean), keyConcepts: (lesson.keyConcepts || []).map(normalizeLessonText).filter(Boolean),
      subject: lesson.subjectId?.name || "", grade: lesson.gradeId?.name || "", textbook: lesson.textbookId?.name || "", chapter: lesson.chapter || "",
    };
    if (!input.summary && !input.objectives?.length && !input.keyConcepts?.length) throw new AnalysisError("ANALYSIS_EMPTY_INPUT", "Bài học cần nội dung hoặc tài liệu nguồn đã trích xuất.", 409);
    const inputTokenEstimate = validateAnalysisSize(input);
    const sourceDigest = contentHash({ input });
    cacheKey = contentHash({ provider: provider.name, model: config.model, promptVersion: LESSON_ANALYSIS_PROMPT_VERSION, schemaVersion: ANALYSIS_SCHEMA_VERSION, sourceDigest });
    locked = Boolean(await Lesson.findOneAndUpdate({ _id: id, $or: [{ analysisLockUntil: { $exists: false } }, { analysisLockUntil: { $lt: new Date() } }] }, { $set: { analysisLockToken: token, analysisLockUntil: new Date(Date.now() + 15 * 60000) } }));
    if (!locked) throw new AnalysisError("ANALYSIS_BUSY", "Bài học đang được phân tích. Vui lòng thử lại sau.", 409);
    const cached = force ? null : await LessonAnalysis.findOne({ lessonId: id, cacheKey }).sort({ version: -1 }).lean() as Record<string, unknown> | null;
    if (cached) {
      const fields = Object.fromEntries(Object.keys(lessonAnalysisSchema.shape).map(key => [key, cached[key]]));
      if (lessonAnalysisSchema.safeParse(fields).success) {
        await recordCacheHit({ provider: provider.name, model: String(cached.model), operation: "lesson_analysis", lessonId: id, cacheKey, cacheSource: "LessonAnalysis", durationMs: Date.now() - started });
        return { ...cached, cached: true };
      }
    }
    const beforeAttempt = async () => {
      if (config.provider === "openai" && (Number(process.env.DAILY_AI_BUDGET || 0) > 0 || Number(process.env.MONTHLY_AI_BUDGET || 0) > 0)) {
        const rules = getPricingConfig().rules;
        const rule = rules[`openai:${config.model}:lesson_analysis`] || rules[`openai:${config.model}`];
        if (!rule || ![rule.inputPerMillionTokens, rule.outputPerMillionTokens, rule.cachedInputPerMillionTokens].every(value => typeof value === "number" && Number.isFinite(value) && value >= 0)) throw new AnalysisError("AI_PRICING_NOT_CONFIGURED", "Cần cấu hình đủ pricing cho model để áp dụng AI budget.", 503);
      }
      await checkBudget();
    };
    await beforeAttempt();
    const output = await provider.analyzeLesson(input, {
      beforeAttempt,
      onAttempt: async attempt => {
        const usage = await recordUsage({ ...attempt, provider: provider.name, providerType: "cloud", operation: "lesson_analysis", lessonId: id, cacheKey, cached: false });
        attemptsRecorded++;
        usageSummary = { model: attempt.model, inputTokens: attempt.inputTokens ?? null, outputTokens: attempt.outputTokens ?? null, cachedInputTokens: attempt.cachedInputTokens ?? null, estimatedCost: usage.estimatedCost, durationMs: attempt.durationMs, requestId: attempt.requestId ?? null };
      },
    });
    const analysis = lessonAnalysisSchema.safeParse(output);
    if (!analysis.success) throw new AnalysisError("AI_INVALID_OUTPUT", "AI output failed schema validation.");
    if (!attemptsRecorded) {
      const usage = await recordUsage({ provider: provider.name, providerType: "local", model: config.model, operation: "lesson_analysis", lessonId: id, cacheKey, durationMs: Date.now() - started });
      attemptsRecorded++;
      usageSummary = { inputTokens: null, outputTokens: null, cachedInputTokens: null, estimatedCost: usage.estimatedCost, durationMs: Date.now() - started };
    }
    if (!await Lesson.exists({ _id: id, analysisLockToken: token, analysisLockUntil: { $gt: new Date() } })) throw new AnalysisError("ANALYSIS_LOCK_LOST", "Phiên phân tích đã hết hạn. Vui lòng thử lại.", 409);
    const latest = await LessonAnalysis.findOne({ lessonId: id }).sort({ version: -1 }).select("version");
    const result = await LessonAnalysis.create({ ...analysis.data, lessonId: id, cacheKey, contentHash: sourceDigest,
      provider: provider.name, model: usageSummary?.model || config.model, requestedModel: config.model, promptVersion: LESSON_ANALYSIS_PROMPT_VERSION, schemaVersion: ANALYSIS_SCHEMA_VERSION,
      sourceReferences: documents.map(doc => doc._id), generatedBy: provider.name, version: (latest?.version || 0) + 1, usage: usageSummary, inputTokenEstimate,
    });
    await Lesson.updateOne({ _id: id }, { status: "processing" });
    return { ...result.toObject(), cached: false };
  } catch (error) {
    if (!attemptsRecorded || error instanceof BudgetExceededError) await recordFailure({ provider: provider.name, model: config.model, operation: "lesson_analysis", lessonId: id, cacheKey, durationMs: Date.now() - started,
      status: error instanceof BudgetExceededError ? "blocked_budget" : error instanceof AnalysisError && error.code === "AI_NOT_CONFIGURED" ? "not_configured" : "failed",
      error: error instanceof AnalysisError || error instanceof BudgetExceededError ? error.message : "Analysis failed",
    }).catch(() => undefined);
    throw error;
  } finally {
    if (locked) await Lesson.updateOne({ _id: id, analysisLockToken: token }, { $unset: { analysisLockToken: "", analysisLockUntil: "" } }).catch(() => undefined);
  }
}
