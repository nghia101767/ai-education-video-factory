# AI and render pipeline

The operational path is source document → lesson analysis → 25–35s script → explicit script approval → 5–7 scene storyboard → Character/Style + library match/image generation → per-scene TTS → editable SRT → optional music/SFX → worker render → video review/approval → YouTube.

Provider and model values come only from environment configuration. Cache identity includes provider, model, prompt version, content hash and generation settings. Image identity additionally includes style/character; TTS includes voice/language. Analysis has its own configurable model and schema version; changing either invalidates its cache.

Structured LLM output is strictly validated for missing/wrong/extra fields, enum errors, invalid/empty/truncated JSON. Provider retry is controlled and exhaustion becomes a failed usage/job, not a process crash. Missing token usage is recorded as unavailable, never fabricated.

Mock mode produces marked SVG images and valid WAV audio. Real OpenAI adapters return `NOT_CONFIGURED` without a key. All implemented analysis/script/validation/storyboard/image/TTS/metadata paths use AIUsage and the budget guard before provider calls.

The render worker claims Mongo jobs with owner/lease timestamps, heartbeats, exponential retry, stale recovery and cancellation polling. Render settings are snapshotted per job. Voice is primary; optional music uses 12% gain and fade in/out, optional scene SFX uses 25%, and FFmpeg applies a limiter. The mixed output passed runtime ffprobe; subjective loudness review remains a human approval task.

## Step 6 — Lesson Analysis (REAL AI, runtime PASS)

The existing `AIProvider.analyzeLesson` and `LessonAnalysis` model are reused. `lib/lesson-analysis-service.ts` owns source preparation, cache, budget, validation, accounting and history. The existing API/batch entry point delegates to it. Script/storyboard/image-generation implementations are unchanged.

Configuration (server-side `.env`, never `NEXT_PUBLIC_*`):

```env
MOCK_AI=false
AI_LLM_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_ANALYSIS_MODEL=gpt-5.6-luna
AI_TIMEOUT_MS=60000
AI_RETRY_LIMIT=2
AI_RETRY_BASE_MS=1000
AI_PRICING_JSON=
```

Use the existing `AI_LLM_PROVIDER=mock` for Mock, or `MOCK_AI=true` to override all AI providers. No duplicate `AI_PROVIDER`/`OPENAI_TIMEOUT_MS` variables were introduced. `OPENAI_ANALYSIS_MODEL` affects only analysis; the existing `OPENAI_MODEL` for later LLM operations is unchanged. `AI_LLM_PROVIDER` is the existing shared LLM selector, so switching it also selects the existing adapters for later steps; those steps were not changed or validated by this task.

The implementation follows [official Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs) and the configurable [GPT-5.6 Luna model](https://developers.openai.com/api/docs/models/gpt-5.6-luna). Dependencies are pinned: `openai@7.15.0`, `zod@4.6.2`, `js-tiktoken@1.0.21`. It uses the official SDK Responses API, `zodTextFormat` with strict JSON Schema, and an independent Zod parse before saving. `responses.create` is intentional: usage remains accessible even for refused/incomplete/invalid results. No free-form JSON-only mode is used for analysis.

### Input, schema and history

- Load Lesson plus attached SourceDocuments from MongoDB; include subject, grade and textbook names, not paths/credentials/database metadata.
- Normalize whitespace and repeated page-boundary headers/footers. Unready/failed/OCR-unconfigured sources block with `ANALYSIS_UNAVAILABLE`. Real OpenAI rejects marked mock OCR.
- The full normalized prompt is limited to 32,000 estimated `o200k_base` tokens (and a 250,000-character safety bound before tokenization). This is a conservative application limit, not a claim about the model's context window or exact billing tokenizer. Oversized lessons return HTTP 413 and must be split into smaller lessons; no silent truncation/chunk merging.
- Preserve existing fields: `sourceSummary`, `learningObjectives`, `keyFacts`, `definitions`, `formulas`, `examples`, `commonMistakes`, `keywords`, `difficulty` (`beginner/intermediate/advanced`). No speculative extra teaching/hook fields were introduced.
- Prompt: `lesson-analysis-v2`; schema: `lesson-analysis-schema-v1`. Source text is treated as untrusted data, not instructions. Unsupported facts should not be invented.
- Save provider, requested/actual model, prompt/schema versions, source references, content hash, cache key and real usage. New versions append to history. A per-lesson Mongo lock prevents simultaneous analysis/regeneration; it expires after 15 minutes if a process dies.

### Cache, usage, pricing and failure

The cache includes normalized full lesson/source content, subject/grade/textbook/chapter, provider, requested model, prompt version and schema version. Reuse validates the cached fields and writes an AIUsage cache event at zero cost without calling OpenAI. `POST /api/lessons/:id/analyze` defaults to reuse; `{ "force": true }` bypasses cache intentionally.

Each attempted OpenAI call records actual returned model, input/output/cached-input tokens, request ID, duration and outcome. Unavailable token fields are `null`. Even validation failures with returned usage are recorded; budget totals include paid failed attempts. Pricing comes only from `AI_PRICING_JSON`, keyed by `openai:<model>:lesson_analysis` or `openai:<model>`, using `inputPerMillionTokens`, `outputPerMillionTokens`, `cachedInputPerMillionTokens`. Configure the actual returned model/snapshot too if needed. No configured rate means cost is `null`, not zero; missing cached-token pricing is not invented. With an enabled budget, analysis requires complete rates before calling OpenAI. The guard checks accumulated spending before each attempt; it is not a concurrent spend-reservation system and a single in-flight request can exceed the remaining amount.

Retry temporary 429/408/5xx/network/timeouts and invalid/incomplete output, normally up to three attempts (`AI_RETRY_LIMIT=2`, capped at four total). Respect `Retry-After`; if it exceeds 60 seconds, fail temporarily rather than retry too early. Authentication, invalid requests/schema configuration, quota exhaustion and refusals do not loop. Timeout uses `AI_TIMEOUT_MS`, capped at 120 seconds per attempt. No fallback to Mock on real-provider failure.

The HTTP endpoint retains the existing synchronous API contract; the UI shows only an honest waiting state and final saved/cache/error result, not invented stage percentages. The batch worker uses the same service via the existing route. Health/config is available at authenticated `/api/health/analysis`, without keys. Help step 6 shows real-AI verification only after a matching OpenAI analysis exists in MongoDB; configured credentials alone are not runtime proof.

### Validation commands and evidence

```bash
npm run typecheck
npm run lint
npm test
npm run build
docker compose config --quiet
docker compose build
docker compose up -d
# Host: login, create real math content + TXT source, analyze, cache, reload UI:
node --env-file=.env tests/browser-analysis.mjs
# Worker: confirm Mongo/usage and invalid output not saved:
docker compose exec -T worker node --import tsx tests/runtime-analysis.mjs
```

For real OpenAI, set the server environment above, recreate web/worker without deleting volumes, then run host `E2E_ANALYSIS_PROVIDER=openai node --env-file=.env tests/browser-analysis.mjs` and worker `docker compose exec -T -e E2E_ANALYSIS_PROVIDER=openai worker node --import tsx tests/runtime-analysis.mjs`. These tests only exercise step 6 and add records; they never reset/delete MongoDB. Do not run subsequent pipeline steps to claim analysis success.

Transport unit tests simulate SDK responses/errors and are **not real OpenAI validation**. Browser fixtures contain real elementary fraction content but Mock results remain explicitly Mock. Missing-key browser mode: `E2E_ANALYSIS_PROVIDER=openai E2E_ANALYSIS_MISSING_KEY=true` against a server configured with OpenAI and an empty key. Reports/screenshots are written to `storage/logs/analysis-<mode>.*`.

Real OpenAI runtime is now **PASS**: an actual Responses API result passed Zod, persisted to MongoDB and survived browser reload. The second unchanged request reused the same analysis without inference. No pricing rates are currently configured, so paid-request estimated cost is honestly `null`; it is not reported as free.

### Real OpenAI runtime — 2026-09-12 (Asia/Ho_Chi_Minh)

| Field | Verified result |
| --- | --- |
| Lesson Analysis / UI / E2E | PASS, real OpenAI |
| Provider / model | `openai` / `gpt-5.6-luna` |
| Lesson ID | `6aa485a49e66fcef87df1689` |
| Source document ID | `6aa485a49e66fcef87df168e` (real extracted TXT fraction lesson) |
| Analysis ID | `6aa485ae9e66fcef87df16d8` |
| Prompt / schema | `lesson-analysis-v2` / `lesson-analysis-schema-v1` |
| Actual usage | 548 input tokens, 379 output tokens, 0 cached-input tokens |
| Request duration | 9,435ms |
| Estimated cost | `null` — `AI_PRICING_JSON` not configured; cached request cost 0 |
| Application cache | PASS: MISS then HIT, same analysis ID |
| MongoDB / AIUsage | PASS: persisted analysis and two successful usage events |
| Budget guard | PASS with injected spend/rate fixtures; no provider call when blocked |
| Invalid output | PASS: injected invalid provider does not save analysis |
| Help step 6 | Backend runtime verification drives ✨ OpenAI, not hard-coded text |

Evidence: `storage/logs/analysis-openai.json`, `analysis-openai.png`, `analysis-openai-database.json`, `analysis-openai-review.json`, `analysis-openai-help.png`. Read-only recheck: `node --env-file=.env tests/browser-analysis-review.mjs` (does not call inference).

The first database test hit the pricing guard before its injected budget assertion, correctly exposing a missing test fixture. The test now supplies rates only inside its process, restores them afterward and asserts zero provider calls. Production pricing was not changed. Mock coverage and the earlier missing-key test remain valid. No script/storyboard/asset generation was performed during Step 6 verification.

## Step 7 — Script Generation (implementation complete)

Step 7 consumes an existing valid `LessonAnalysis` plus lesson metadata; it never reruns Step 6. It reuses the Step 6 official OpenAI Responses transport, strict `zodTextFormat` Structured Outputs, retry/error mapping, budget guard and `AIUsage` accounting. The script-specific model is `OPENAI_SCRIPT_MODEL` (default `gpt-5.6-luna`), prompt version is `script-generation-v2`, and schema version is `script-schema-v2`.

The v2 contract is backward-compatible with legacy Script documents and adds complete narration, conclusion, target 30 seconds with a validated 25–35 second estimate, consistent ordered scene segments, keywords, analysis/provider/requested-model/actual-model/prompt/schema provenance, generation style/instruction, usage, versioned draft/approval/rejection workflow, and timestamps. Vietnamese narration is validated as short plain TTS-friendly speech. Manual save validates the merged record without calling AI or replacing provenance; regenerate appends a new version.

The cache key includes provider, requested model, prompt/schema versions, analysis and complete input hashes, target duration, style and instruction. Valid unedited cached scripts are reused with a zero-cost cache-hit `AIUsage` event. A per-lesson expiring lock protects duplicate generation. Missing analysis, invalid output, budget blocks and provider failures do not persist a script.

Authenticated routes cover lesson generation/history and direct script get/save/regenerate/approve/reject. The Step 7 UI reports configured versus runtime-verified OpenAI status, loading/errors, editable script/scenes, provenance, cache result and workflow controls. It does not create a storyboard or any downstream artifact.

Full procedure and runtime evidence: [`docs/step-7-verification.md`](step-7-verification.md).

## Step 9 — Real AI Storyboard Generation (implemented and verified)

Step 9 accepts only an approved persisted Script and never re-runs LessonAnalysis or script generation. It reuses the official OpenAI Responses API transport, `zodTextFormat` strict Structured Outputs, retry classification, budget guard, deterministic cache, and AIUsage accounting from Steps 6–7. Configuration uses `OPENAI_STORYBOARD_MODEL`, falling back to the common OpenAI model; the verified model was `gpt-5.6-luna`. The central Vietnamese prompt is `storyboard-generation-v1`, and the additive schema is `storyboard-schema-v1`.

Storyboard documents contain lesson/script identity, title, duration, 9:16, 30 fps, provider/model/prompt/schema provenance, workflow status and timestamps. Scene documents remain compatible with downstream code while adding order, camera, transition, on-screen text, and typed Step-10-ready asset requirements. Validation enforces unique sequential order from 1, positive non-overlapping timelines, a final time within the target, 25–35 seconds (30 preferred), concrete visual plans, and nonempty asset requirements. Generation does not create assets.

Authenticated APIs provide get/generate/cache, forced regenerate with optional instruction, validated manual save without AI, approve and reject. Storyboard generation has no Video import or persistence coupling and does not create, update, or return a Video. Storyboard Studio uses MongoDB as its source of truth, derives exact readiness text and disabled generation controls from the fetched Script status, and shows runtime provider state, format/duration/count, timeline cards, all creative fields, editable typed asset requirements, generation/regeneration, edit/save and workflow controls. Cache identity includes provider/model/prompt/schema/script hash/target/visual settings/instruction. Budget checking occurs before provider calls; blocked requests do not save Storyboards.

Real E2E evidence: existing approved Step-7 Script `6aa515f6ce98a05f40f359bd` produced Storyboard `6aa53aeb0c3c1db7afee71a6` with 6 scenes/30 seconds. Forced regeneration used 1,107 input and 1,745 output tokens; the same instruction then hit cache. Manual edit/save, approval, browser reload, and persistence after web/worker restart passed. Pricing is absent, so estimated cost correctly remains `null`. See [`docs/step-9-verification.md`](step-9-verification.md).

## Step 10 — Asset Library & Asset Management (component PASS; real image BLOCKED)

Step 10 consumes only persisted requirements from approved Storyboard `6aa53aeb0c3c1db7afee71a6`. It lists/searches/filters/previews visual assets, validates and uploads genuine PNG/JPEG/WEBP files, hashes and reuses duplicates, edits metadata, ranks reusable candidates, and maps/replaces/unmaps Assets through deduplicated `AssetUsage` records. Delete is blocked while any Scene or usage references an Asset. Storage and provider output paths are confined to controlled image storage. It has no Video create/update/import coupling and does not invoke TTS, render, or YouTube.

Local runtime passed all 23 API/Mongo categories plus rendered-browser reload. Final persisted map: Scene `6aa53c3eb68af19acd1e71a4`, requirement `scene-1-requirement-1`, Asset `6aa7eb047b3082aee3632a7e`, Usage `6aa7eb049be2633f33215f63`. PNG/JPEG/WEBP dimensions were 321×479, 333×222, and 257×389. All 13 Video projections were unchanged before/after; Storyboard/Script/LessonAnalysis survived a safe web/worker restart.

Mock image was verified separately: marked 1080×1920 SVG, MISS then HIT, two persisted zero-cost AIUsage events, and runtime budget block before provider action. The OpenAI image adapter now uses the official `openai@7.15.0` SDK with SDK retries disabled, typed/sanitized errors, and at most three application attempts only for transient 429/server/network failures. It honors Retry-After and otherwise uses bounded exponential+jitter delay; credit/quota, organization/project spend limits, authentication, invalid request, and budget failures never retry or fall back to Mock. Returned bytes must be an actual, fully decodable single-frame PNG/JPEG/WEBP with matching MIME/signature/integrity, safe `images/` path, valid dimensions, and bounded size before Asset persistence.

Exactly one real diagnostic on 2026-09-14 used `gpt-image-1` and returned HTTP `429`, type `insufficient_quota`, code `credit_balance_exhausted`, request ID `req_feb1dd51737a4dfab72fd55b7555de7c`, with no Retry-After header. Therefore real image generation remains **BLOCKED**, not a PASS and not silently replaced by Mock. Add OpenAI organization credits and ensure project spend access, then rerun the conditional real Storyboard E2E. The deployed default remains explicitly Mock until `AI_IMAGE_PROVIDER=openai` is selected and a successful real request is proven. Full evidence: [`docs/step-10-verification.md`](step-10-verification.md).

### Earlier runtime report — before credentials were supplied

| Check | Result |
| --- | --- |
| Lesson Analysis overall | **PARTIAL** — OpenAI credentials missing |
| Provider / model exercised end to end | `mock-local` / `mock-analysis-v1` |
| Real provider configured model | `openai` / `gpt-5.6-luna`; NOT_CONFIGURED |
| Prompt / schema | `lesson-analysis-v2` / `lesson-analysis-schema-v1` |
| Mock UI → API → service → Mongo → reload | PASS, Chromium |
| Real TXT extracted source used | PASS; fraction lesson, `1/2` content visible in stored Mock analysis |
| Cache / AIUsage | PASS, initial MISS + HIT, two success usage records; cached cost 0 |
| Force history / content invalidation | PASS, new versions; changed lesson produces a different cache key |
| Invalid output not persisted | PASS, injected invalid provider; analysis count unchanged |
| Budget | PASS for guard behavior with injected aggregate totals; provider not called |
| Missing-key API/UI | PASS, HTTP 503 / `AI_NOT_CONFIGURED`, no analysis saved |
| OpenAI SDK / schema / retry | PASS with simulated transport; **not a real OpenAI API test** |
| Real OpenAI E2E / actual tokens / paid cost | NOT RUN — API key unavailable |

Mock evidence: lesson `6aa481cfeee2882c40e4a49d`, source `6aa481cfeee2882c40e4a4a2`, analysis `6aa481d0eee2882c40e4a4eb`, 733ms first Mock analysis, token fields null, estimated cost 0. Initial browser result: `storage/logs/analysis-mock.json`, screenshot `analysis-mock.png`; database checks: `analysis-mock-database.json`. The database test subsequently creates newer Mock versions to verify force/content invalidation without deleting the initial version.

Missing-key evidence: lesson `6aa481ed5a5a6388d55553d4`, no analysis ID; `storage/logs/analysis-missing-key.json` and `analysis-missing-key.png`. This was tested with a temporary web container bound only to `127.0.0.1:3002`; it has been stopped, leaving MongoDB/test records intact. The main web was Mock during this earlier run; it now uses OpenAI.

Typecheck/lint/build and 35 unit tests passed. Docker dependency installation initially stalled, then Next's optional SWC download failed on a network socket error. Build retries succeeded after npm cache reuse; Dockerfile web now includes optional dependencies and checks its platform SWC compiler explicitly. No database reset, volume deletion, script generation, storyboard generation or asset generation was performed for this task.

## Switchable image providers (2026-09-14)

Image generation now resolves `ai.image.provider` and `ai.image.model` from MongoDB `SystemSetting` on every request, so saving Settings takes effect without a process restart. The centralized registry exposes `mock`, `openai`, `huggingface`, and `gemini`; adapters return validated binary buffers with MIME, dimensions, SHA-256, request ID, and usage metadata. Routes do not call vendors directly. Provider and model are part of cache identity and persisted on Asset/AIUsage. Real unknown prices remain `null`.

`GET/PATCH /api/settings/ai` is authenticated by the existing middleware and never returns credentials. Allowed non-secret keys are `ai.image.provider`, `ai.image.model`, `ai.image.huggingface.model`, and `ai.image.gemini.model`. Credentials remain server-only: `OPENAI_API_KEY`, `HF_TOKEN`, and `GEMINI_API_KEY`. `IMAGE_PROVIDER=mock` is the environment default; `AI_IMAGE_PROVIDER` remains a lower-priority compatibility alias, not a second settings system.

Provider verification: Mock is adapter/unit/build tested and is reported only as Mock. OpenAI preserves the official SDK, SDK retries disabled, bounded application retry, and sanitized normalized errors; `gpt-image-1` is treated as paid and was NOT TESTED in the switchable-provider verification. Hugging Face uses the official inference router binary response flow, defaulting to `black-forest-labs/FLUX.1-schnell`; adapter binary validation is tested, but no `HF_TOKEN` was present and zero-cost inference eligibility could not be established, so no real call ran. Gemini is selectable and its configured adapter validates inline image data; without server key/model or established free-tier eligibility it returns `CONFIGURATION_ERROR` and never falls back. FREE PROVIDER TESTED: none. Failures are normalized to `CONFIGURATION_ERROR`, `AUTHENTICATION_ERROR`, `QUOTA_EXCEEDED`, `RATE_LIMITED`, `BUDGET_EXCEEDED`, `INVALID_REQUEST`, `PROVIDER_ERROR`, `INVALID_IMAGE`, or `NETWORK_ERROR`, and persist a failure AIUsage row with provider/model/errorCode without creating an Asset, AssetUsage, file, or Scene mapping.
