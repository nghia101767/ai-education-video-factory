# Step 10 — Asset Library & Asset Management verification

Verified **2026-09-14 (Asia/Ho_Chi_Minh)** against approved Storyboard `6aa53aeb0c3c1db7afee71a6`. No database reset/deletion, volume removal, render, TTS, YouTube action, or Video create/update/import was used.

## Verdict

**Component-level PASS; Step 10 overall PARTIAL / BLOCKED for real AI image generation.** Library, upload, reuse, matching, mapping, persistence, Mock image, cache, usage, and budget behavior pass. On 2026-09-14, exactly one minimal real diagnostic request to configured model `gpt-image-1` returned HTTP `429`, type `insufficient_quota`, code `credit_balance_exhausted`. This is an exhausted billing-credit balance—not a transient rate limit—so the implementation did not retry, change keys, bypass billing, or fall back to Mock. The conditional real Storyboard E2E was not run.

## OpenAI 429 Diagnosis

| Field | Evidence |
|---|---|
| Request | One `images.generate` call through official `openai@7.15.0`; SDK retries disabled (`maxRetries: 0`) |
| Prompt | `Simple educational illustration of a Vietnamese elementary school classroom, clean flat illustration, vertical composition.` |
| HTTP / type / code | `429` / `insufficient_quota` / `credit_balance_exhausted` |
| Sanitized provider message | `You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.` |
| Request ID | `req_feb1dd51737a4dfab72fd55b7555de7c` |
| Retry/rate-limit headers | No `Retry-After` or rate-limit headers returned |
| Organization / project response identifiers | `nghia-nguyen-huu` / `proj_nVE7MNPJBjPHWYovSIFiLYRc` |
| Model / result | `gpt-image-1` / **BLOCKED — credit balance exhausted** |
| Required user action | Add credits at OpenAI organization billing and confirm the project can spend them; then rerun this Step 10 verification. Do not rotate/bypass the key. |

## 18-item evidence report

1. **Scope / safety — PASS.** Only Asset Library, visual asset mapping, image-provider metadata/validation, tests, and docs were changed. No render/TTS/YouTube flow ran. No `docker compose down -v`, database reset, or existing-record deletion ran. A disposable E2E-owned asset was created and deleted solely to prove safe-delete behavior.
2. **Approved upstream — PASS.** Storyboard `6aa53aeb0c3c1db7afee71a6`, Script `6aa515f6ce98a05f40f359bd`, LessonAnalysis `6aa485ae9e66fcef87df16d8`; Storyboard remained `approved`, had 6 persisted scenes, and its complete projection was unchanged by the E2E.
3. **Library/UI — PASS.** Authenticated `/dashboard/assets` loaded, displayed provider state, 4 filtered Step-10 cards and 4 image previews, exposed metadata controls, and passed browser reload. Screenshot: `storage/logs/step-10-asset-library.png`.
4. **List/search/filter — PASS.** `GET /api/assets` pagination/list, search marker, exact type filter, and all-tag filter returned persisted Mongo records and deterministic newest-first results.
5. **Upload formats/integrity — PASS.** Genuine local PNG/JPEG/WEBP bytes were decoded and stored. Asset IDs: PNG `6aa7eb047b3082aee3632a7e`, JPEG `6aa7eb047b3082aee3632a86`, WEBP `6aa7eb047b3082aee3632a8b`. Actual dimensions: 321×479, 333×222, 257×389. MIME, extension, signature, end marker/container length, SHA-256, byte size, and dimension limits are checked.
6. **Storage/preview protection — PASS.** PNG preview returned signature `89504e470d0a1a0a`. Absolute paths, NULs, and `..` traversal are rejected by storage resolution; provider output must match `images/[safe filename]`.
7. **Upload dedupe/reuse — PASS.** Re-uploading identical PNG bytes/type returned the same Asset ID `6aa7eb047b3082aee3632a7e` with `reused: true`; no duplicate file/Asset was created.
8. **Rename/metadata — PASS.** PATCH persisted name, description, normalized deduplicated tags, role/style/character fields; unsupported metadata fields are rejected.
9. **Ranked matching — PASS.** Matching uses compatible type, tags, normalized description words, role, style, aspect ratio, and character identity. Runtime results were descending by score and returned reusable candidates before generation.
10. **Map/reuse — PASS.** Scene `6aa53c3eb68af19acd1e71a4`, requirement `scene-1-requirement-1`, was mapped to genuine local PNG `6aa7eb047b3082aee3632a7e`; mapping references the Asset and does not copy files.
11. **AssetUsage dedupe — PASS.** Repeating the same mapping produced exactly one usage. Final usage ID: `6aa7eb049be2633f33215f63`. Mapping now removes all prior usage rows for that scene/requirement before its upsert, including same-asset role changes.
12. **Replace/unmap — PASS.** Replacement Asset `6aa7eb047b3082aee3632abb` replaced the mapping and usage exactly once; unmap removed mapping/usage and stale `assetIds`; the genuine PNG was then remapped for final persisted state.
13. **Delete guard/safe delete — PASS.** Deleting the mapped replacement returned HTTP 409. A newly created, unreferenced E2E disposable icon was deleted successfully and its storage delete remained confined to an allowed folder.
14. **Mock provider/cache — PASS.** `mock-local` produced a visibly marked 1080×1920 SVG. Unique request first result was MISS, second was HIT at `images/943940adfc879ba4c9a3021aef08920e9c9a0bce9d5366a9406623378757356d.svg`; Mock was tested separately and never presented as real.
15. **AIUsage/budget — PASS.** MISS/HIT usage IDs `6aa7ecc956c5f17edd81beab` and `6aa7ecc956c5f17edd81bebc` persisted with cached `[false,true]` and cost `[0,0]`. Runtime budget aggregation used explicit additive fixture `6aa7ecc99be2633f3321749f` and blocked before provider action; unit tests independently cover daily/monthly guard behavior.
16. **Real image provider — BLOCKED.** Exactly one diagnostic reached OpenAI and returned `429 insufficient_quota / credit_balance_exhausted` with request ID `req_feb1dd51737a4dfab72fd55b7555de7c`. No Retry-After header was present. This non-retryable billing condition prevented any image, Asset, AssetUsage, Scene mapping, paid AIUsage success row, or real E2E. Current deployed default remains explicitly `mock` because `AI_IMAGE_PROVIDER` is not selected in `.env`.
17. **Video/downstream isolation — PASS.** All 13 Video documents were projected before/after across identity, links, status, version, dimensions, paths, timestamps, and metadata; count stayed 13 and the immutable projection was byte-for-byte equal. Storyboard projection was also equal. Counts before→after E2E: storyboards 2→2, scenes 66→66, scripts 15→15, lesson analyses 17→17, videos 13→13, assets 78→82, usages 81→82, AIUsage 356→356 (Mock/budget verification then added three documented AIUsage rows only).
18. **Quality/deploy/persistence — PASS except real image blocker above.** After hardening, `npm run typecheck`, `npm run lint`, `npm test` (58/58), and `npm run build` passed. Real E2E and web/worker restart persistence were not run because the diagnostic did not pass. The 13 Video documents were snapshotted before/after final verification and remained byte-identical (`SHA-256 a488b2f0ce0fffd35998350c3f08d71fc77f3b29c110e99a4f5793ea428d1053` both times), including historical Video `6aa53aeb9be2633f33208359`. Evidence: `storage/logs/step10-video-before.json` and `storage/logs/step10-video-after.json`.

## Automated coverage

`tests/asset.test.mjs` provides practical byte-level PNG/JPEG/WEBP, storage confinement, cache identity, matching, provider selection, missing-key coverage, typed/sanitized OpenAI errors, all required 429 variants, Retry-After, exponential+jitter backoff, max-three attempts, no-retry quota/spend/auth/invalid failures, no Mock fallback, and rejection of invalid/empty/truncated/oversized responses before storage. Existing regression/runtime coverage proves cache hits avoid provider work and budget rejection occurs before provider action; prior Step 10 runtime evidence proves Asset persistence and mapping. No real E2E was run while billing was blocked. `tests/runtime-assets.mjs` executes 23 runtime categories: list, search, type filter, tag filter, preview, PNG/JPEG/WEBP integrity+dimensions, upload, hash reuse, rename, metadata edit, traversal rejection, ranked matching, map, usage dedupe, replace, unmap, delete guard, safe delete, Mongo persistence, approved-Storyboard isolation, and Video isolation. `tests/runtime-assets-ai.mjs` proves Mock MISS/HIT, marked output, AIUsage, zero Mock cost, and budget block. `tests/browser-assets-review.mjs` proves rendered UI, previews, controls, and reload.

## Commands used

```bash
npm run typecheck
npm run lint
npm test # 58/58
npm run build
docker compose build web worker
docker compose up -d --no-deps web worker
docker compose exec -T worker node tests/runtime-assets.mjs
docker compose exec -T worker node --import tsx tests/runtime-assets-ai.mjs
node --env-file=.env tests/browser-assets-review.mjs
docker compose restart web worker
```

## Switchable-provider addendum — 2026-09-14

The image path now loads Mongo-backed provider/model settings per request, then applies factory → budget (cloud) → provider/model cache → adapter generation → shared byte validation → storage → Asset → AIUsage → mapping. Compensating cleanup removes newly-created file/Asset/success-AIUsage/mapping if a post-generation step fails; provider/configuration/budget failures persist exactly one failure AIUsage row with provider, model, status, and normalized errorCode. Cache lookup is explicitly separated by provider and model. The Settings browser flow exercises save/reload transitions Mock → Hugging Face → OpenAI → Gemini and restores the initial selection afterward. The historical Video `6aa53aeb9be2633f33208359` is compared before/after through its authenticated API projection and must remain byte-identical.

Real-provider status remains honest: OpenAI **BLOCKED (credits; no repeat paid call)**; Hugging Face **NOT CONFIGURED** when `HF_TOKEN` is absent (no real call); Gemini **NOT CONFIGURED** when its key/model is absent. Only Mock is end-to-end generation verified; adapters and configuration/error paths for the real providers are test-verified, not claimed as real generation passes.

Final verification counts: `npm test` **76/76 PASS** (the two focused image files are **29/29 PASS**); ESLint **PASS with 0 warnings/errors**; TypeScript **PASS**; production build **PASS** with `/api/settings/ai` present; authenticated Settings browser E2E **4/4 provider save/reload transitions PASS** and restored `mock / mock-image-v1`; atomic unconfigured-HF runtime check **PASS** with Asset count 82 unchanged, mapping unchanged, no file side effect, and exactly one failure AIUsage row containing `provider=huggingface`, `model=black-forest-labs/FLUX.1-schnell`, `success=false`, and `errorCode=CONFIGURATION_ERROR`; settings API invalid-provider and invalid-model checks **2/2 returned 400** and credential-shaped fields were absent. Historical Video `6aa53aeb9be2633f33208359` passed **2 byte-identical before/after API snapshots** (Settings E2E and atomic-failure runtime). Real calls in this addendum: Hugging Face **0** (`HF_TOKEN` absent), OpenAI **0** (paid model; prohibited by the current cost rule), Gemini **0** (no key and free-tier eligibility not established).

## Cost-controlled provider verification

- **FREE PROVIDER TESTED:** none. Neither Hugging Face nor Gemini had credentials, and no provider/model was proven to be a zero-cost free-tier request, so no real generation was attempted.
- **PAID PROVIDER:** OpenAI `gpt-image-1` — **NOT TESTED in this switchable-provider implementation**. Its adapter/configuration/error/cache paths pass, but this is not a real OpenAI E2E claim. The earlier `credit_balance_exhausted` diagnostic above belongs to the prior 429 diagnosis and was not repeated.
- Other paid or uncertain-cost image providers/models — **NOT TESTED**.
- Mock — **PASS**, explicitly as Mock only; it is never reported as a real-provider pass.
