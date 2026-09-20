# Project status

Last implementation regression: **2026-09-14**. Evidence: [`docs/step-10-verification.md`](docs/step-10-verification.md), [`docs/IMPLEMENTATION_REPORT.md`](docs/IMPLEMENTATION_REPORT.md), [`docs/final-implementation-report.md`](docs/final-implementation-report.md) and [`docs/regression-test-report.md`](docs/regression-test-report.md).

## Current verdict

**Production readiness: NOT READY**

The complete mock user journey works against MongoDB, shared storage, the real worker and FFmpeg: login → curriculum CRUD → source extraction/mock OCR → analysis → script → approval → storyboard → Character/Style → reusable images → TTS → editable SRT → music/SFX → MP4 → download/review → approval. The latest mixed output was probed as H.264, 1080×1920, 30 fps and AAC with a 33.334-second duration.

## Verified runtime

- Admin `admin@huunghia.dev` exists once in the active application database; password is stored as scrypt, not plaintext.
- HTTPS-forwarded login issues a Secure, HttpOnly, SameSite=Lax cookie; dashboard/session/logout and API 401 behavior pass.
- Web and worker use `mongodb:27017`; MongoDB remains healthy and its volume was never removed.
- Worker heartbeat, queue polling, render claim/lease, retries, cancellation hooks, graceful restart and stale lease reclaim are implemented.
- Shared storage is readable from web and worker and persisted after both containers restarted.
- Mock AI generated clearly marked assets and valid WAV audio; cache reuse and AIUsage records were observed in MongoDB.
- Latest backup `backups/mongodb-20260909-065021.archive` (287 KB) restored into separate database `ai_education_video_factory_regression_restore_20260909_impl`; verification found 26 collections, 10 lessons, 8 videos and 37 assets. The active database was never used as a restore target.
- `npm test`: 76/76; typecheck, lint and Next production build pass. Compose web/worker builds and deployed restart checks pass. The earlier audit result remains documented in the implementation reports.
- Step 10 Asset Library component runtime passed 23 API/Mongo categories plus browser reload using genuine local PNG/JPEG/WEBP files. Final map is Scene `6aa53c3eb68af19acd1e71a4` → Asset `6aa7eb047b3082aee3632a7e`; Usage `6aa7eb049be2633f33215f63`. All 13 Video projections remained unchanged.
- Development and production Compose configs/builds pass. The standard web/worker images were deployed and the final runtime E2E passed on those images.
- The redeployed web container passed internal-network `/login` → authenticated `/dashboard/help` → logout smoke. The Codex shell could not resolve/reach the browser-facing OrbStack hostname during the final probe; this is recorded as an **ENVIRONMENT LIMITATION**, not an application failure.

## Provider status

- AI LLM lesson analysis (Step 6), script generation (Step 7), and storyboard generation (Step 9): **REAL OPENAI RUNTIME PASS**, `gpt-5.6-luna`, Responses API + strict Structured Outputs + Zod.
- AI Image: **COMPONENT PASS / REAL BLOCKED**. The official SDK transport, typed/sanitized errors, non-overlapping bounded transient retry, Retry-After, no-retry quota/spend/auth/invalid/budget behavior, no Mock fallback, and PNG/JPEG/WEBP validation are covered. Exactly one real `gpt-image-1` diagnostic returned `429 insufficient_quota / credit_balance_exhausted` (request `req_feb1dd51737a4dfab72fd55b7555de7c`); no real E2E or success is claimed. Deployed default remains Mock.
- AI TTS: **MOCK verified**; real OpenAI **NOT CONFIGURED**.
- YouTube: **MOCK verified not to claim publication**; real OAuth/upload **NOT CONFIGURED**.
- YouTube Analytics: **MOCK preview verified and not persisted**; real sync **NOT CONFIGURED**.
- OCR: **MOCK verified with explicit prefix**; real OCR **NOT CONFIGURED**.

## Remaining blockers

- Add credits in OpenAI organization billing, verify project `proj_nVE7MNPJBjPHWYovSIFiLYRc` can spend them, then rerun the single diagnostic and real Step 10 E2E (current result: `429 credit_balance_exhausted`). Configure/runtime-test real OpenAI TTS and production pricing. Steps 6, 7, and 9 are real-runtime verified; Step 10 library/mapping is component-verified but is not marked fully implemented-and-verified while real image remains blocked.
- Configure and runtime-test Google OAuth, encrypted tokens, private upload and analytics sync.
- Add browser automation for form clicks, navigation, preview and React console/hydration checks. HTTP route smoke and backend E2E passed, but no browser engine was available in this run.
- Run subjective loudness/content review on production audio; automated FFmpeg attenuation/fade/limiter and AAC output are verified.
- Run the full three-video approval-gated batch E2E. Queue dependency/recovery and three-lesson pause/resume/cancel passed.

## Step 7 real runtime — 2026-09-12

Using existing Lesson `6aa485a49e66fcef87df1689` and real OpenAI LessonAnalysis `6aa485ae9e66fcef87df16d8`, Step 7 generated script `6aa515e3ce98a05f40f35990` and regenerated version `6aa515f6ce98a05f40f359bd`. Initial usage was 939 input / 1,626 output tokens; explicit regeneration used 919 / 2,137. The unchanged request was a cache hit on the same initial script, with a separate zero-cost AIUsage record and no second OpenAI request. Mongo reload, web/worker restart persistence, manual save metadata preservation, approve/reject, budget block, missing-analysis failure, UI status/scenes and downstream isolation all passed. See [`docs/step-7-verification.md`](docs/step-7-verification.md).

## Step 9 real runtime — 2026-09-12

Using the existing Step-7 Script `6aa515f6ce98a05f40f359bd`, Step 9 generated and regenerated Storyboard `6aa53aeb0c3c1db7afee71a6`: 6 scenes, 30 seconds, 9:16 at 30 fps, status `approved`. Verified regeneration usage was 1,107 input / 1,745 output tokens; estimated cost remained `null` because pricing is not configured. Same-instruction cache HIT, AIUsage persistence, manual edit/save without AI, approval, actual Script-derived readiness, editable asset requirements, real browser UI/reload, Video-isolation, and persistence after web/worker restart passed. The final Step 9 service does not import, create, update, or return Video records. See [`docs/step-9-verification.md`](docs/step-9-verification.md). A superseded pre-review implementation created draft Video `6aa53aeb9be2633f33208359`; the corrected implementation removed all Video coupling, and the record was preserved rather than deleted under the no-deletion rule.

## Step 10 Asset Library runtime — 2026-09-14

Against approved Storyboard `6aa53aeb0c3c1db7afee71a6`, list/search/type/tag filters, preview, genuine PNG/JPEG/WEBP upload and dimensions, hash reuse, rename/metadata, ranked matching, map/replace/unmap, AssetUsage dedupe, delete guard, safe E2E-owned delete, browser reload, and restart persistence passed. Mock image MISS/HIT and zero-cost AIUsage passed; runtime budget blocking occurred before provider action. Video count stayed 13 and a complete immutable Video projection was byte-for-byte unchanged. Exactly one real image diagnostic returned `429 insufficient_quota / credit_balance_exhausted`; this is a billing-credit block, so it was not retried and the conditional real E2E was not run. The overall Step 10 verdict is **PARTIAL / BLOCKED**, not `IMPLEMENTED_AND_VERIFIED`. See [`docs/step-10-verification.md`](docs/step-10-verification.md).

## Data safety

No database, current MongoDB volume, existing lesson/video/asset, or storage directory was deleted. Step 7 added versioned Script/AIUsage evidence; Step 9 added versioned Storyboard/Scene/AIUsage evidence only. The corrected Step 9 implementation does not create or mutate Asset, Video, TTS, render, or YouTube records. One draft Video created by the superseded pre-review implementation is retained unchanged because deletion was prohibited. New E2E records are otherwise prefixed `E2E`; restore used a separate test database.

## Switchable Image Providers — 2026-09-14

Mongo-backed request-time image selection is implemented for Mock, OpenAI, Hugging Face, and Gemini through authenticated `/api/settings/ai` and the Settings UI. Non-secret provider/model values persist in `SystemSetting`; credentials stay environment-only. Provider/model-aware cache identity, shared binary validation, normalized errors, atomic cleanup, and additive AIUsage `errorCode` support are included. Mock and adapters are unit/build tested. Real OpenAI remains credit-blocked without another paid diagnostic; Hugging Face and Gemini are adapter/configuration-tested and must not be labeled real-generation verified unless their credentials and a successful call are separately proven. Existing Steps 6/7/9, assets, Mongo data, and historical Video `6aa53aeb9be2633f33208359` are preserved.

Verification: 76/76 unit tests, 29/29 focused image tests, lint, typecheck, production build, 4/4 browser provider transitions, authenticated settings validation, atomic failure isolation with one persisted failure AIUsage row, safe web rebuild/health, and two byte-identical historical Video snapshots passed. Selection was restored to `mock / mock-image-v1`. Cost-controlled verification made zero real provider calls: OpenAI `gpt-image-1` is a paid provider and was NOT TESTED; Hugging Face had no token and no zero-cost inference eligibility could be established; Gemini had no key and no established free-tier eligibility. These providers remain adapter/config-tested only. FREE PROVIDER TESTED: none.
