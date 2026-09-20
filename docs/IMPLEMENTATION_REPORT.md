# Implementation report

Date: 2026-09-09  
Environment: OrbStack, Next.js 15.5.24, MongoDB 7, Docker Compose, FFmpeg 5.1  
Overall verdict: **NOT READY for production**; **mock local-video pipeline is operational**.

This report separates source presence from runtime evidence. A passing build alone is not treated as feature completion. No MongoDB volume, active database, existing lesson/video/asset, or storage directory was deleted.

## Implemented

- Authentication with Mongo-backed session, signed token, Secure/HttpOnly/SameSite cookie, logout invalidation, UI redirect and API authorization.
- Live Dashboard plus validated Subject, Grade, Textbook and Lesson persistence.
- Local SourceDocument upload with size, extension, MIME/signature, hash and safe-path controls; TXT/PDF/DOCX extraction and explicitly labelled mock image OCR.
- Mock and OpenAI provider abstractions for LLM, image and TTS, including structured validation, controlled retry, cache, budget and AIUsage.
- Lesson analysis history, script generation/edit/review/approval, storyboard generation/edit/add/delete/reorder and downstream approval gate.
- Character Profile and Style Preset CRUD, scene assignment and inclusion in image prompts/cache identity.
- Asset upload/search/filter/preview/reuse, explicit scene assignment and safe in-use delete guard.
- Per-scene TTS generation/cache/force-regeneration and protected media preview.
- UTF-8 SRT generation/view/edit/save plus FFmpeg subtitle burn-in.
- Configurable render dimensions/FPS/subtitle margin, per-scene image/voice/SFX, background music, attenuation, fades, limiter and real MP4 output.
- Mongo-backed RenderJob polling, atomic claim, lease/heartbeat, retry/backoff, cancellation signal, stale recovery and graceful worker shutdown.
- Video list/detail/preview/download, guarded delete, approval/rejection and render retry.
- Generic batch queue with dependency gates and Start/Pause/Resume/Cancel/Retry controls.
- YouTube OAuth/upload/analytics adapters with OAuth state validation, encrypted tokens, approved-video gate and private default. Mock publish never claims success.
- Live operational analytics, cost dashboard, settings persistence, backup/isolated restore scripts and interactive Help.

## Fixed

- HTTPS OrbStack login remained on `/login` because middleware tried to validate the session through the public hostname; validation now uses the internal web service.
- Cache normalization could drop nested identity data and reuse results across provider/model/settings changes.
- Source upload jumped directly to a final state and removed evidence on post-persist failures; it now persists `UPLOADED → PROCESSING → final` and records `FAILED` safely.
- Image uploads had no explicit OCR test path; mock OCR is now clearly labelled and real mode reports `OCR_NOT_CONFIGURED`.
- Image/TTS regeneration appended assets, while the renderer kept selecting the oldest one; replacement now preserves one active asset per media type and updates usage records.
- Manual scene asset reuse, Character Profile and Style Preset existed only partially; API/UI integration is now present.
- Absolute render paths stored by the worker could not be resolved by web download/delete. Absolute paths are now accepted only inside the configured storage root; outside paths remain blocked.
- Subtitle content could only be changed indirectly at scene level; Video Studio now has persisted SRT generate/view/edit/save operations.
- Background music/SFX selection did not reach FFmpeg. Render jobs now snapshot paths/settings and the worker performs a limited mix with fades and clipping protection.
- Video listing/download/delete lifecycle was incomplete; live authenticated routes and UI were added with state guards.
- YouTube publish saved user metadata but sent generated metadata to the provider; the requested title/description/tags are now the upload payload.
- OAuth callback performed a redundant incomplete channel write and discarded actual token expiry; both issues were corrected.
- YouTube UI exposed an authorization URL without navigating to it and mock mode looked actionable; real mode now redirects, mock mode is explicitly unavailable.
- Analytics only exposed snapshots; live video/render/publishing summaries are now queried from MongoDB.

## Verified

- Authentication: login/session/logout/API 401 and HTTPS cookie behavior.
- MongoDB: authenticated application read/write through Docker service `mongodb:27017`.
- Shared storage: web/worker interoperability and restart persistence.
- Source: runtime TXT upload/extraction/hash/lesson attachment and spoof rejection; PDF/DOCX unit extraction.
- Mock AI: analysis, script, storyboard, image and TTS persistence; schema checks, cache and AIUsage.
- Approval gates: storyboard requires approved script; publish requires approved video.
- Media: asset assignment, Character/Style prompt integration, editable SRT, music/SFX render and authenticated MP4 download.
- Worker: startup, polling, claim, heartbeat, completion, failure/retry code path, cancellation hook, stale reclaim and graceful restart.
- FFmpeg/ffprobe: valid H.264 video at 1080×1920 and 30 fps, AAC audio, 33.334 seconds, 636,060 bytes.
- Batch control: three lessons, 21 jobs, pause prevented new claims, resume continued, cancel changed queued work to cancelled.
- Docker: development config/build/up/health/logs and production config/build.
- Backup/restore: `backups/mongodb-20260909-065021.archive` restored only into `ai_education_video_factory_regression_restore_20260909_impl`; 26 collections, 10 lessons, 8 videos and 37 assets were readable.

UI routes returned authenticated production HTML, but browser controls, responsive layout, media playback and React console behavior were not automated. Corresponding modules remain `IMPLEMENTED_BUT_NOT_VERIFIED` in the feature matrix.

## Mock Only

- LLM and image generation in the current environment remain mock; OpenAI credentials are absent. TTS now uses real Docker VieNeu and also retains a verified mock provider; see the Docker VieNeu section.
- Image OCR: mock output is explicitly prefixed and flagged in metadata; no real OCR provider is configured.
- YouTube publishing/analytics in the current environment: mock behavior is safety-tested and never records a fake publication.

## Not Implemented

- Real OCR provider.
- ASS subtitle generation and a visual subtitle style editor/overlay before render.
- YouTube thumbnail upload/selection.
- Explicit audio detach/delete control in the UI; the VieNeu preset selector is now implemented.
- Automated subjective audio loudness/content review.

## Broken

No reproducible blocking defect remains in the tested mock local-video path. This does not certify unexecuted real-provider or browser paths.

## Remaining Work

1. Configure and runtime-test real OpenAI LLM/image/TTS, including real pricing and a minimal paid E2E.
2. Configure Google OAuth and verify token refresh, encrypted token lifecycle, channel lookup, private upload and real analytics.
3. Run a browser E2E covering all forms, navigation, loading/empty/error states, mobile layout, media playback and React console/hydration warnings.
4. Run a full three-video batch through both manual approval gates; only three-lesson pause/resume/cancel is currently verified.
5. Perform human content, pronunciation, subtitle-legibility and audio-mix review before publishing.

## Test Results

| Check | Result | Evidence / limitation |
|---|---|---|
| Typecheck | PASS | `npm run typecheck` |
| Lint | PASS | `npm run lint`, no warnings |
| Unit Test | PASS | `npm test`, 23/23 |
| Build | PASS | `npm run build`, 43 pages |
| Dependency audit | PASS | `npm audit --omit=dev`, 0 vulnerabilities |
| Docker | PASS | Development config/build/up/ps/logs; production config/build |
| Runtime | PASS | Healthy MongoDB; web/worker connected; internal-network login → Help → logout smoke passed |
| E2E Mock | PASS | Complete single-video pipeline, including mixed audio and download |
| FFmpeg | PASS | ffprobe verified H.264/AAC, dimensions, fps and duration |
| Batch | PARTIAL | Three-lesson controls pass; three completed approved videos not run |
| Browser E2E | NOT VERIFIED | No browser engine-driven interaction run; Codex shell could not reach the OrbStack hostname (`ENVIRONMENT LIMITATION`) |
| Real OpenAI | NOT CONFIGURED | Credentials unavailable; no success fabricated |
| YouTube real | NOT CONFIGURED | Credentials unavailable; mock is not treated as published |

## E2E Result

| Artifact | Value |
|---|---|
| Subject ID | `6a9ff2d45f96365d865962b6` |
| Grade ID | `6a9ff2d45f96365d865962be` |
| Textbook ID | `6a9ff2d45f96365d865962c4` |
| Lesson ID | `6a9ff2d45f96365d865962cd` |
| Script ID | `6a9ff2d45f96365d865962f3` |
| Character ID | `6a9ff2d45f96365d8659631c` |
| Style ID | `6a9ff2d45f96365d86596320` |
| Video ID | `6a9ff2d49be2633f330d7d8d` |
| Render Job ID | `6a9ff2d45f96365d86596406` |
| Output MP4 | `/app/storage/videos/render-6a9ff2d49be2633f330d7d8d-6a9ff2d45f96365d86596406.mp4` |
| Subtitle | `/app/storage/subtitles/render-6a9ff2d49be2633f330d7d8d-6a9ff2d45f96365d86596406.srt` |
| Duration | 33.334 seconds |
| Size | 636,060 bytes |

Batch control run: batch `a660fbc2-2d2f-4ca8-886d-961467634bdb`, three lessons, 21 queued jobs; final test cleanup used the product cancel action, not database deletion.

## Commands executed

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm audit --omit=dev`
- `docker compose config`
- `docker compose build`
- `docker compose up -d`
- `docker compose ps`
- `docker compose logs web`
- `docker compose logs worker`
- `docker compose -f docker-compose.prod.yml config`
- `docker compose -f docker-compose.prod.yml build`
- `npm run test:e2e-runtime`
- `npm run test:batch-runtime`
- `scripts/backup-mongodb.sh`
- `scripts/restore-mongodb.sh backups/mongodb-20260909-065021.archive ai_education_video_factory_regression_restore_20260909_impl`
- Mongo read-only count verification and worker-container `ffprobe`.

## Production decision

**NOT READY.** The system is usable for local mock-assisted video creation and produces a real MP4. Production release is blocked by unverified real AI/YouTube credentials, missing browser E2E, incomplete full-batch approval run and required human media-quality review.

## Docker VieNeu-TTS integration

Browser follow-up (2026-09-11): PASS on Chrome 152.0.7977.84. Login, Trúc Ly selection, queued cache job polling, voice/status restoration after reload, WAV play/pause/seek and MP4 preview passed without page errors. Fixed the voice selector resetting to Default after reload and corrected stale in-app Help text. Evidence: `storage/logs/vieneu-browser.json` and `storage/logs/vieneu-browser.png`. This verifies the TTS browser path, not every application page or subjective pronunciation quality.

Status: PASS for Docker VieNeu preset TTS. Python/eSpeak/model/HTTP/worker/storage/cache/AIUsage/subtitle/FFmpeg/E2E all PASS. Two real MP4s were generated: Default 32.534s and Trúc Ly 40.359s, with 48kHz speech. Restart of TTS/worker, network-none offline inference, invalid inputs, cancel/retry and mock E2E passed. Peak RSS reached 2,543 MiB; cached offline startup was 1.973s on standalone restart and 3.480s on final full-stack startup. Xet initially stalled; the documented HTTP download fallback completed the model cache. The existing Job/Asset/AIUsage architecture is reused and no MongoDB reset or volume deletion was performed. TTS browser regression passed as described above; pronunciation review remains manual and voice cloning remains phase 2. Detailed outputs, versions and evidence: [tts.md](tts.md).
