export type PricingRule = { inputPerMillionTokens?: number; cachedInputPerMillionTokens?: number; outputPerMillionTokens?: number; perImage?: number; perCharacter?: number; perAudioSecond?: number };
export type PricingConfig = { version: string; currency: string; rules: Record<string, PricingRule> };

export function getPricingConfig(): PricingConfig {
  const raw = process.env.AI_PRICING_JSON;
  if (!raw) return { version: "unconfigured", currency: "USD", rules: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<PricingConfig>;
    return { version: parsed.version || "custom", currency: parsed.currency || "USD", rules: parsed.rules || {} };
  } catch {
    return { version: "invalid", currency: "USD", rules: {} };
  }
}

export function calculateCost(provider: string, operation: string, model: string | undefined, usage: { inputTokens?: number; cachedInputTokens?: number; outputTokens?: number; imageCount?: number; audioSeconds?: number; characters?: number }): number | null {
  const config = getPricingConfig();
  const selectedModel = model || "default";
  const rule = config.rules[`${provider}:${selectedModel}:${operation}`]
    || config.rules[`${provider}:${selectedModel}`];
  if (!rule) return null;
  if ((usage.inputTokens || 0) > 0 && rule.inputPerMillionTokens === undefined) return null;
  if ((usage.outputTokens || 0) > 0 && rule.outputPerMillionTokens === undefined) return null;
  let total = 0;
  let priced = false;
  if (rule.inputPerMillionTokens !== undefined && usage.inputTokens !== undefined) {
    const cached = Math.max(0, Math.min(usage.inputTokens, usage.cachedInputTokens || 0));
    if (cached > 0 && rule.cachedInputPerMillionTokens === undefined) return null;
    total += ((usage.inputTokens - cached) * rule.inputPerMillionTokens + cached * (rule.cachedInputPerMillionTokens || 0)) / 1_000_000; priced = true;
  }
  if (rule.outputPerMillionTokens !== undefined && usage.outputTokens !== undefined) { total += usage.outputTokens / 1_000_000 * rule.outputPerMillionTokens; priced = true; }
  if (rule.perImage !== undefined && usage.imageCount !== undefined) { total += usage.imageCount * rule.perImage; priced = true; }
  if (rule.perAudioSecond !== undefined && usage.audioSeconds !== undefined) { total += usage.audioSeconds * rule.perAudioSecond; priced = true; }
  if (rule.perCharacter !== undefined && usage.characters !== undefined) { total += usage.characters * rule.perCharacter; priced = true; }
  return priced ? Number(total.toFixed(8)) : null;
}
