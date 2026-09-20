# Full regression test report

> Superseded for the implementation-completion phase by [`final-implementation-report.md`](final-implementation-report.md), dated 2026-09-08. The original 2026-08-31 findings below are retained as historical evidence; several former PARTIAL items are now implemented and runtime-tested.

Date: 2026-08-31  
Environment: OrbStack / Docker Compose / MongoDB 7 / Next.js 15.5.24  
Final verdict: **NOT READY**

This report separates unit/source verification, Docker runtime, mock E2E, real-provider verification and environment limitations. A passing test suite alone is not treated as production readiness.

## Model migration

**Luna references: PASS/FOUND** — no Luna-specific production configuration or business-logic assumption was found. The only Luna string after the audit is an intentional regression fixture proving that `luna-model` cache output cannot be reused by `sol-model`; it is historical test input and was not blindly replaced.

**Sol configuration: PASS** — application model names remain configuration-driven. LLM, image and TTS configuration centralizes provider, model, API-key presence, timeout and retries. Sol is the coding-agent environment change, not a reason to hard-code `sol` in application logic.

Cache keys include provider, model, prompt version, content hash and normalized generation settings. The former stable serializer dropped nested properties and could collide; recursive stable normalization now preserves nested content.

## Authentication

**PASS**

Docker runtime checks covered login, session, logout, unauthenticated dashboard redirect, protected API 401, authenticated access and tampered JWT rejection. Cookies are HttpOnly, SameSite=Lax, and Secure on forwarded HTTPS. Middleware checks the server-side session through Docker's internal web address rather than calling the external OrbStack hostname, preventing a login redirect loop when the container cannot resolve its public HTTPS domain. Replay after logout returns 401.

## MongoDB

**PASS**

The target was confirmed before writes: `ai_education_video_factory`, user `app_user`, matching `authSource`, internal host `mongodb:27017`. Web and worker connect. A marker document was upserted/read in `regression_probes`; no existing data or volumes were deleted.

## Worker

**PARTIAL**

Render-worker startup, MongoDB connection, polling, atomic claim, lease ownership, stale lease recovery, completion and graceful SIGTERM were exercised. It runs directly as PID 1 and has no Docker/OrbStack socket dependency. A real stale RenderJob was recovered and completed.

Generic job primitives enforce prerequisite completion, block dependants after retry exhaustion, let independent jobs continue, and release expired leases. However, there is no continuously running generic domain worker, so API batch jobs remain queued. Running render cancellation records a request but does not terminate FFmpeg in flight.

## FFmpeg

**PARTIAL**

`ffmpeg -version` passed inside the worker. A real sample was probed as MP4, 1080x1920, 9:16, 30 fps, H.264 and AAC. Voice, background music and SFX test tones were mixed with volume, fades and loudness normalization. Vietnamese SRT text was burned correctly.

The application renderer still creates a synthetic sample instead of composing selected storyboard/assets/TTS/subtitles, and subtitle safe-area placement needs tuning. The media primitive passes; product rendering is partial.

## AI LLM

**MOCK** — real provider **NOT_CONFIGURED**. Mock covered lesson analysis, script generation, script validation, storyboard and YouTube metadata. No real success was fabricated.

## AI Image

**MOCK** — real provider **NOT_CONFIGURED**. Missing credentials now return controlled `not_configured` instead of silently becoming a production-looking mock result.

## AI TTS

**MOCK** — real provider **NOT_CONFIGURED**. Mock outputs are explicit; cache identity includes provider/model/voice/language.

## AIUsage

**PARTIAL**

Runtime mock requests recorded provider, model, operation, status, cached flag and duration. Cache hits and mock generation cost zero; unknown real pricing stays null rather than inventing token counts. Budget blocks use `blocked_budget` and skip provider invocation. Coverage remains incomplete for every product path, notably script validation, image generation and YouTube metadata orchestration.

## Cache

**PASS**

Tests prove different provider/model/prompt version/settings miss, including Luna versus Sol; identical input hits. Image identity includes prompt/style/character/provider/model. TTS identity includes narration/voice/provider/model/language.

## Cost control

**PASS** for implemented calls and tested behavior. Pricing requires provider plus model, known pricing calculates, missing pricing returns null, cache hits cost zero, failures are tracked, and daily/monthly guards block before provider invocation.

## Batch

**PARTIAL/FAIL**

Dependency, failure propagation, independent continuation and stale-lease primitives pass. A three-lesson API batch created expected chains, but jobs stayed queued because no generic consumer exists. Full pause/resume and safe running-process cancellation were not demonstrated. This is a production blocker.

## YouTube

**NOT_CONFIGURED**

OAuth state validation/tamper rejection are covered; channel tokens are excluded from API/UI reads. Mock OAuth no longer stores encrypted fake tokens or claims a real connection. Real OAuth, channel lookup, private upload, thumbnail and metadata were not credential-tested. No path defaults to public publishing.

## Analytics

**PARTIAL**

The model and APIs exist and AIUsage-backed mock data was queryable. There is no complete real-provider analytics collection flow, and not all AI operations are wired.

## Backup

**PASS**

Created `backups/mongodb-20260831-205104.archive` plus metadata. Restore succeeded into separate database `ai_education_video_factory_regression_restore_20260831`, and restored documents were verified. Restore refuses the active database, requires a `_regression_restore_` target, and never uses `--drop`.

## Security

**PARTIAL**

Targeted checks passed for traversal, MIME spoofing, route upload-size enforcement, unauthorized APIs, invalid/tampered sessions, MongoDB operator injection, OAuth state tampering, token leakage and unsafe Docker socket mounts. No `dangerouslySetInnerHTML`, dynamic `eval`, user-controlled FFmpeg shell command or user-controlled provider URL was found. A full browser security assessment and actual oversized-file upload were not performed.

## Docker

**PARTIAL**

Development config/build/up/ps/log checks passed. Web and worker are running; MongoDB is healthy; localhost and the OrbStack hostname responded in this run. Web/worker MongoDB access and shared storage passed. Production Compose config passes. Its final image rebuild after the dependency override stalled at the registry/package-install layer and was interrupted: **ENVIRONMENT LIMITATION**, not a successful production build.

## Tests

**PASS** for implemented automation: 17/17 tests plus TypeScript, ESLint and Next.js build pass without React Hook warnings. `npm audit` reports zero vulnerabilities. This does not override partial/failed product E2E results.

Added regression coverage for malformed structured output, bounded retry and exhaustion, cache model separation, provider-scoped pricing, cache-hit cost, daily/monthly budget, all-provider mock override, image/TTS cache dimensions, traversal, MIME spoofing, cookie flags and every structured mock operation.

## Production readiness

**NOT READY**

### Bugs found and fixed

- Nested cache-key collisions; recursive stable normalization added.
- Structured-format failures not uniformly retried; strict parsing plus controlled retry added without weakening validation.
- Scattered provider/model/timeout/retry settings; centralized configuration added.
- Image requests without credentials silently mocked; now controlled `not_configured`.
- Model-only pricing fallback; provider-scoped lookup added.
- Incorrect/incomplete mock cost and `blocked_budget` tracking.
- Image/TTS cache keys missing critical dimensions.
- Storage traversal and upload MIME spoofing.
- Copied JWT usable after logout; server-side session existence now enforced.
- Secure cookie incorrectly set on HTTP.
- Five React Hook warnings and CSS compatibility warnings fixed at their causes.
- Render sample lacked AAC audio.
- Job dependency blocking, retry-exhaustion propagation and stale recovery incomplete.
- Render completion could be written after lease ownership was lost.
- Worker process wrapper impaired signal handling.
- Mock YouTube OAuth persisted fake connected state.
- Backup/restore scripts lacked safe separate-target behavior.
- Mock script exceeded the required 25–35 seconds; E2E exposed it and a test now enforces it.
- PostCSS audit findings resolved with a compatible override, without a blind major upgrade.

### Runtime and E2E outcomes

- Mock flow passed: create lesson → analysis → script → approval → storyboard → assets → TTS, including cache reuse.
- It could not continue through product subtitle/render/video review/approval because video orchestration and scene-driven rendering are missing.
- Three-lesson batch creation passed, but execution did not progress because the generic worker is absent.
- Valid standalone and stale-job-recovered MP4s were generated; these are not a complete product E2E.
- No real AI or YouTube test ran because credentials are absent.

### Commands executed

Key commands: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm audit --json`, development Compose config/build/up/ps/logs, production Compose config/build attempts, internal HTTP/API probes, authenticated MongoDB read/write probes, `ffmpeg`, `ffprobe`, the job regression script, backup and separate-database restore.

### Remaining blockers

1. Implement the generic batch dispatcher and full pause/resume/cancel behavior.
2. Implement scene/asset/TTS/subtitle-driven render and safe in-flight FFmpeg cancellation.
3. Add video orchestration and complete browser E2E for Video Studio.
4. Finish required content/settings UI and operation-wide AIUsage wiring.
5. Configure and verify real OpenAI and YouTube providers.
6. Rerun the final production image build with stable registry access.
