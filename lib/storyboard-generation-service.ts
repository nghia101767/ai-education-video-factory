import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { Lesson, Scene, Script, Storyboard } from "@/models";
import { connectToDatabase } from "@/lib/mongodb";
import { storyboardConfig } from "@/lib/ai/config";
import { contentHash } from "@/lib/ai/cache";
import { FallbackAIProvider } from "@/lib/ai/fallback-provider";
import { OpenAILLMProvider } from "@/lib/ai/openai-provider";
import { storyboardOutputSchema, STORYBOARD_SCHEMA_VERSION, type StoryboardOutput } from "@/lib/ai/storyboard-schema";
import { STORYBOARD_GENERATION_PROMPT_V1 } from "@/lib/ai/prompts/storyboard-generation";
import { AnalysisError } from "@/lib/ai/analysis-response";
import { checkBudget, recordCacheHit, recordFailure, recordUsage, BudgetExceededError } from "@/lib/ai/usage-service";
import { validateStoryboard } from "@/lib/storyboard";
import type { AIProvider, ScriptOutput } from "@/lib/ai/types";

export const SCRIPT_APPROVAL_MESSAGE = "Kịch bản phải được phê duyệt trước khi tạo Storyboard.";
export type StoryboardSettings = { force?: boolean; instruction?: string };
function scriptInput(script: Record<string, unknown>) {
  return { title: script.title, hook: script.hook, narration: script.narration, conclusion: script.conclusion || "", targetAudience: script.targetAudience || "Học sinh", educationalGoal: script.educationalGoal || "", callToAction: script.callToAction || "", estimatedDuration: Number(script.estimatedDuration || script.duration), targetDuration: 30 as const, scenes: Array.isArray(script.scenes) ? script.scenes : [], keywords: Array.isArray(script.keywords) ? script.keywords : [] } as ScriptOutput;
}
function sceneDocuments(output: StoryboardOutput, ids: { storyboardId: unknown; scriptId: unknown; cacheKey: string }) {
  return output.scenes.map(scene => ({ ...scene, storyboardId: ids.storyboardId, scriptId: ids.scriptId, sceneNumber: scene.order, imagePrompt: scene.assetRequirements.map(item => item.description).join("; "), subtitleText: scene.onScreenText || scene.narration, cacheKey: ids.cacheKey, status: "draft" }));
}
export async function getCurrentStoryboard(scriptId: string) {
  await connectToDatabase();
  const storyboard = await Storyboard.findOne({ scriptId }).sort({ version: -1 }).lean() as Record<string, unknown> | null;
  if (!storyboard) return null;
  const scenes = await Scene.find({ scriptId, storyboardId: storyboard._id }).sort({ sceneNumber: 1 }).populate("assetIds").lean();
  return { ...storyboard, scenes };
}
export async function generateScriptStoryboard(id: string, settings: StoryboardSettings = {}, providerOverride?: AIProvider) {
  if (!Types.ObjectId.isValid(id)) throw new AnalysisError("INVALID_ID", "Script ID không hợp lệ.", 400);
  await connectToDatabase();
  const config = storyboardConfig();
  if (!["mock", "openai"].includes(config.provider)) throw new AnalysisError("AI_NOT_CONFIGURED", "Storyboard provider chưa được cấu hình.", 503);
  const provider = providerOverride || (config.provider === "openai" ? new OpenAILLMProvider() : new FallbackAIProvider());
  const started = Date.now(), token = randomUUID(), storyboardId = new Types.ObjectId(); let cacheKey = "", locked = false, recorded = 0; let usageSummary: Record<string, unknown> | undefined;
  try {
    const script = await Script.findById(id).lean() as Record<string, unknown> | null;
    if (!script) throw new AnalysisError("SCRIPT_NOT_FOUND", "Không tìm thấy kịch bản.", 404);
    if (script.status !== "approved") throw new AnalysisError("SCRIPT_NOT_APPROVED", SCRIPT_APPROVAL_MESSAGE, 400);
    const targetDuration = Number(script.targetDuration || script.estimatedDuration || script.duration || 30);
    const input = { ...scriptInput(script), duration: targetDuration, instruction: settings.instruction?.trim() || "" };
    if (input.instruction.length > 1000) throw new AnalysisError("STORYBOARD_INPUT_INVALID", "Hướng dẫn tạo lại quá dài.", 400);
    const scriptHash = contentHash({ title: input.title, narration: input.narration, scenes: input.scenes, duration: targetDuration });
    cacheKey = contentHash({ provider: provider.name, model: config.model, promptVersion: STORYBOARD_GENERATION_PROMPT_V1, schemaVersion: STORYBOARD_SCHEMA_VERSION, scriptHash, targetDuration, visualSettings: { aspectRatio: "9:16", fps: 30, sceneLength: "short" }, instruction: input.instruction });
    locked = Boolean(await Lesson.findOneAndUpdate({ _id: script.lessonId, $or: [{ storyboardLockUntil: { $exists: false } }, { storyboardLockUntil: { $lt: new Date() } }] }, { $set: { storyboardLockToken: token, storyboardLockUntil: new Date(Date.now() + 15 * 60000) } }));
    if (!locked) throw new AnalysisError("STORYBOARD_BUSY", "Storyboard đang được tạo. Vui lòng chờ.", 409);
    const cached = settings.force ? null : await Storyboard.findOne({ scriptId: id, cacheKey, manuallyEdited: { $ne: true } }).sort({ version: -1 }).lean() as Record<string, unknown> | null;
    if (cached) {
      const scenes = await Scene.find({ scriptId: id, storyboardId: cached._id }).sort({ sceneNumber: 1 }).lean();
      if (scenes.length) { await recordCacheHit({ provider: provider.name, providerType: config.provider === "mock" ? "local" : "cloud", model: String(cached.model), operation: "storyboard_generation", lessonId: script.lessonId, scriptId: id, storyboardId: cached._id, cacheKey, cacheSource: "Storyboard", durationMs: Date.now() - started }); return { ...cached, scenes, cached: true, validation: validateStoryboard(scenes as never[], targetDuration) }; }
    }
    const beforeAttempt = async () => { await checkBudget(); };
    await beforeAttempt();
    const output = await provider.generateStoryboard(input, { beforeAttempt, onAttempt: async attempt => { const usage = await recordUsage({ ...attempt, provider: provider.name, providerType: "cloud", operation: "storyboard_generation", lessonId: script.lessonId, scriptId: id, storyboardId, cacheKey }); recorded++; usageSummary = { ...attempt, estimatedCost: usage.estimatedCost, usageId: usage._id }; } });
    const parsed = storyboardOutputSchema.safeParse(output);
    if (!parsed.success) throw new AnalysisError("AI_INVALID_OUTPUT", "Storyboard AI trả về không hợp lệ.", 422);
    const validation = validateStoryboard(parsed.data.scenes, targetDuration);
    if (!validation.valid) throw new AnalysisError("STORYBOARD_INVALID", validation.errors.join("; "), 422);
    if (!recorded) { const usage = await recordUsage({ provider: provider.name, providerType: "local", model: config.model, operation: "storyboard_generation", lessonId: script.lessonId, scriptId: id, storyboardId, cacheKey, durationMs: Date.now() - started }); usageSummary = { model: config.model, inputTokens: null, outputTokens: null, estimatedCost: usage.estimatedCost, usageId: usage._id }; }
    const latest = await Storyboard.findOne({ scriptId: id }).sort({ version: -1 }).select("version");
    const storyboard = await Storyboard.create({ ...parsed.data, _id: storyboardId, lessonId: script.lessonId, scriptId: id, cacheKey, contentHash: scriptHash, provider: provider.name, model: usageSummary?.model || config.model, requestedModel: config.model, promptVersion: STORYBOARD_GENERATION_PROMPT_V1, schemaVersion: STORYBOARD_SCHEMA_VERSION, instruction: input.instruction, usage: usageSummary, status: "generated", version: (latest?.version || 0) + 1 });
    await Scene.deleteMany({ scriptId: id });
    const scenes = await Scene.insertMany(sceneDocuments(parsed.data, { storyboardId, scriptId: id, cacheKey }));
    return { ...storyboard.toObject(), scenes, cached: false, validation };
  } catch (error) {
    if (!recorded || error instanceof BudgetExceededError) await recordFailure({ provider: provider.name, model: config.model, operation: "storyboard_generation", scriptId: id, storyboardId, cacheKey, durationMs: Date.now() - started, status: error instanceof BudgetExceededError ? "blocked_budget" : "failed", error: error instanceof Error ? error.message : "Storyboard generation failed" }).catch(() => undefined);
    throw error;
  } finally { if (locked) await Lesson.updateOne({ storyboardLockToken: token }, { $unset: { storyboardLockToken: "", storyboardLockUntil: "" } }).catch(() => undefined); }
}
