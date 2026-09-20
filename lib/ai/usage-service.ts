import { randomUUID } from "node:crypto";
import { AIUsage } from "@/models";
import { calculateCost, getPricingConfig } from "@/lib/ai/pricing";

export type UsageInput = { provider: string; providerType?: "local" | "cloud"; model?: string; operation: string; lessonId?: unknown; scriptId?: unknown; storyboardId?: unknown; sceneId?: unknown; requestId?: string; inputTokens?: number; outputTokens?: number; cachedInputTokens?: number; imageCount?: number; audioSeconds?: number; characters?: number; durationMs?: number; cached?: boolean; cacheSource?: string; cacheKey?: string; status?: "success" | "failed" | "not_configured" | "blocked_budget"; success?: boolean; error?: string; errorCode?: string };

export class BudgetExceededError extends Error { code = "blocked_budget"; constructor(message: string) { super(message); } }

export function estimateCost(input: UsageInput) { return input.cached || input.provider === "vieneu" || input.provider.startsWith("mock") ? 0 : calculateCost(input.provider, input.operation, input.model, input); }

export async function recordUsage(input: UsageInput) {
  const config = getPricingConfig();
  return AIUsage.create({ ...input, inputTokens: input.inputTokens ?? null, outputTokens: input.outputTokens ?? null, cachedInputTokens: input.cachedInputTokens ?? null, requestId: input.requestId || randomUUID(), estimatedCost: estimateCost(input), currency: config.currency, usageUnavailable: input.inputTokens === undefined && input.outputTokens === undefined && input.imageCount === undefined && input.audioSeconds === undefined, status: input.status || "success", success: input.success ?? (!input.status || input.status === "success") });
}

export async function recordCacheHit(input: UsageInput) { return recordUsage({ ...input, cached: true, status: "success", error: undefined }); }
export async function recordFailure(input: UsageInput) { return recordUsage({ ...input, status: input.status || "failed" }); }

export async function recordBudgetBlock(input: UsageInput) { return recordUsage({ ...input, status: "blocked_budget", error: input.error || "AI budget exceeded" }); }

export function assertBudgetAvailable(daily: number, monthly: number, dayTotal: number, monthTotal: number) {
  if (daily > 0 && dayTotal >= daily) throw new BudgetExceededError("AI daily budget exceeded");
  if (monthly > 0 && monthTotal >= monthly) throw new BudgetExceededError("AI monthly budget exceeded");
}

export async function checkBudget() {
  const daily = Number(process.env.DAILY_AI_BUDGET || 0); const monthly = Number(process.env.MONTHLY_AI_BUDGET || 0);
  if (!daily && !monthly) return;
  const now = new Date(); const day = new Date(now); day.setHours(0, 0, 0, 0); const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const dayResult = await AIUsage.aggregate([{ $match: { createdAt: { $gte: day }, status: { $in: ["success", "failed"] }, cached: { $ne: true }, estimatedCost: { $ne: null } } }, { $group: { _id: null, total: { $sum: "$estimatedCost" } } }]);
  const monthResult = await AIUsage.aggregate([{ $match: { createdAt: { $gte: month }, status: { $in: ["success", "failed"] }, cached: { $ne: true }, estimatedCost: { $ne: null } } }, { $group: { _id: null, total: { $sum: "$estimatedCost" } } }]);
  assertBudgetAvailable(daily, monthly, dayResult[0]?.total || 0, monthResult[0]?.total || 0);
}

export async function getCostSummary(from?: Date, to = new Date()) {
  const start = from || new Date(new Date().setHours(0, 0, 0, 0));
  return AIUsage.aggregate([{ $match: { createdAt: { $gte: start, $lte: to } } }, { $group: { _id: { provider: "$provider", model: "$model", operation: "$operation" }, totalCost: { $sum: { $ifNull: ["$estimatedCost", 0] } }, requests: { $sum: 1 }, cachedRequests: { $sum: { $cond: ["$cached", 1, 0] } } } }, { $sort: { totalCost: -1 } }]);
}
