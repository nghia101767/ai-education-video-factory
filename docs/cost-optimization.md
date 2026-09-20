# Cost optimization

AIUsage stores provider, model, operation, status, cached flag, estimated cost and duration. It records token/image/audio quantities only when providers return them. Pricing lookup is keyed by `provider:model:operation`; unknown pricing stays `null` and mock/cache hits cost zero.

The cost dashboard shows daily/monthly totals, request/cache counts, average per rendered video, unknown-cost count and configured budgets. `DAILY_AI_BUDGET` and `MONTHLY_AI_BUDGET` are checked before provider calls; an exceeded budget records `blocked_budget` and no provider request is sent.

Reuse order is database cache/library first, provider second. The runtime E2E repeated analysis, storyboard, image and TTS requests and observed cached AIUsage records. Configure versioned `AI_PRICING_JSON` before treating USD totals as complete.
