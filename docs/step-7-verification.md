# Step 7 — Real AI Script Generation verification

Status: **PASS — real OpenAI runtime verified on 2026-09-12**.

## Scope and architecture

Step 7 reuses the Step 6 transport and operational infrastructure. `OpenAILLMProvider.generateScript()` calls the official OpenAI SDK Responses API through `requestSchemaResponse()`, with `zodTextFormat()` strict Structured Outputs and an independent `scriptSchema.parse()` before MongoDB persistence. It never invokes lesson analysis. Missing or invalid `LessonAnalysis` returns an error before any provider call.

Production defaults to OpenAI when `AI_LLM_PROVIDER` is omitted. Mock remains selectable for development/tests with `AI_LLM_PROVIDER=mock` or `MOCK_AI=true`; it is not the production default and is never accepted as real-runtime proof.

Server-only configuration:

```env
AI_LLM_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_SCRIPT_MODEL=gpt-5.6-luna
AI_TIMEOUT_MS=60000
AI_RETRY_LIMIT=2
AI_RETRY_BASE_MS=1000
AI_PRICING_JSON=
DAILY_AI_BUDGET=0
MONTHLY_AI_BUDGET=0
```

No credential is hard-coded, returned by health APIs, stored with scripts, or exposed to browser JavaScript.

## Contract

A generated v2 script preserves the legacy script fields and adds:

- `lessonId`, required `analysisId`, title, hook, complete narration, conclusion, CTA, audience and educational goal.
- `estimatedDuration` from 25–35 seconds, `targetDuration: 30`, 4–6 requested scenes, sequential scene order, and scene durations summing to the estimate within 0.5 seconds.
- Scene narrations that concatenate exactly to the complete narration.
- Vietnamese, short, plain TTS-friendly spoken text without Markdown/HTML/emoji or difficult symbolic notation.
- Keywords; provider; requested and actual model; prompt (`script-generation-v2`) and schema (`script-schema-v2`) versions; content/cache hash; optional instruction/style; usage; status; version; timestamps.
- Workflow status `draft`, `approved`, or `rejected` for v2 records. Legacy enum values remain readable to avoid destructive migration.

Manual edits validate the complete merged script, save without AI, preserve provenance/cache/usage metadata, mark `manuallyEdited`, clear approval/rejection timestamps and return to draft. Approve revalidates. Reject records `rejectedAt`. Regenerate appends a new version and never overwrites history.

## API

All routes are covered by the existing authenticated `/api/:path*` middleware:

- `POST /api/lessons/:lessonId/scripts/generate` — body: optional `analysisId`, `instruction`, `style`; defaults to cache reuse.
- `GET /api/lessons/:lessonId/scripts` — versioned history for reload.
- `GET /api/scripts/:scriptId` — one persisted script.
- `PATCH /api/scripts/:scriptId` — backward-compatible update.
- `POST /api/scripts/:scriptId/save` — explicit manual-save alias; no provider call.
- `POST /api/scripts/:scriptId/regenerate` — force a new version from the same analysis, with optional instruction/style.
- `POST /api/scripts/:scriptId/approve` and `/reject`.
- `GET /api/health/script` — provider/model/configured/runtimeVerified and prompt/schema metadata, never a key.

A per-lesson expiring Mongo lock prevents overlapping generation. The cache identity includes provider, requested model, prompt/schema versions, full analysis/content hashes, 30-second target, style and instruction. Cache reuse validates the stored schema and writes a zero-cost `AIUsage` cache-hit event. Manually edited records are not reused as AI cache artifacts.

Before every OpenAI attempt, Step 7 applies the shared pricing completeness check and budget guard. Every paid attempt, including returned invalid output, records actual provider model/request ID/input/output/cached-input tokens and duration. Retry and sanitized error mapping are inherited from the Step 6 Responses transport. Auth/schema/quota/refusal failures do not loop; bounded temporary/network/timeout/invalid-output retries do.

## Automated verification

```bash
npm run typecheck
npm run lint
npm run build
npm test
docker compose config
docker compose build web worker
```

Focused unit coverage in `tests/script.test.mjs` checks schema/duration/scene consistency/Vietnamese TTS text, official Responses payload, strict Structured Outputs, actual usage, failure/retry behavior, missing key, budget-before-provider, and complete cache identity.

Real additive E2E (never deletes data and never invokes storyboard/assets/video/TTS/YouTube):

```bash
node --env-file=.env tests/browser-script.mjs
docker compose exec -T worker node --import tsx tests/runtime-script.mjs
# restart only application containers, preserving Mongo volume
docker compose restart web worker
# rerun read-only UI/API persistence inspection
```

Fixed Step 6 input fixture:

- Lesson ID: `6aa485a49e66fcef87df1689`
- LessonAnalysis ID: `6aa485ae9e66fcef87df16d8`

## Real runtime evidence

The fixed real Step 6 analysis produced a real Step 7 script through OpenAI Responses API → strict Structured Outputs → independent Zod validation → MongoDB. The unchanged second request returned the same script from application cache and created a separate zero-cost AIUsage event; its paid OpenAI request count remained one. Manual title save preserved all provenance and usage, approve and reject persisted, and regenerate created a new v3 script through a second intentional OpenAI request. Browser UI rendered both versions without page errors.

| Evidence | Result |
| --- | --- |
| Lesson / analysis | `6aa485a49e66fcef87df1689` / `6aa485ae9e66fcef87df16d8` |
| Initial script | `6aa515e3ce98a05f40f35990`, version 2, cache key `f5379c8f3ce8aec0c60051955939f5a65bc05c733cef0e025b148106f552a574` |
| Regenerated script | `6aa515f6ce98a05f40f359bd`, version 3 |
| Provider/model | `openai`; requested and actual `gpt-5.6-luna` |
| Prompt/schema | `script-generation-v2` / `script-schema-v2` |
| Initial usage | 939 input, 1,626 output, 0 cached-input tokens; request `req_bec811aec05d4f1d98e1aee5bfaa714d`; AIUsage `6aa515f6ce98a05f40f35998` |
| Cache hit | same initial script ID; AIUsage `6aa515f6ce98a05f40f359a9`; `cached=true`, estimated cost 0; no second provider request |
| Regenerate usage | 919 input, 2,137 output, 0 cached-input tokens; request `req_95d6052cc2854027ba2e694cdfb9ddb9`; AIUsage `6aa5160dce98a05f40f359c4` |
| Cost | paid request cost `null`, truthfully unknown because production `AI_PRICING_JSON` is not configured |
| Missing analysis / budget | injected fixtures proved zero provider calls; invalid output was not persisted |
| Manual edit / statuses | metadata preserved; draft → approved → rejected; regeneration appended version 3 |
| Persistence | both IDs loaded after browser reload and after `docker compose restart web worker` |
| UI | real-runtime OpenAI badge, model/schema/scenes/statuses rendered; no browser page errors |
| Step 6 / downstream | source analysis remains `provider=openai`; zero Scene/Video/Asset records for these scripts |

Required gates passed: typecheck, lint, production build, 40/40 unit tests, `docker compose config --quiet`, and `docker compose build web worker`. Images were deployed and web/worker restarted without removing the MongoDB volume.

Evidence artifacts: `storage/logs/script-openai.json`, `script-openai-database.json`, `script-openai-restart.json`, and `script-openai.png`. The restart review is read-only and records `inferenceCalled: false`. A Mock result is never accepted as this PASS.
