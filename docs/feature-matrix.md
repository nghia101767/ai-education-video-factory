# Feature matrix

Updated 2026-09-09. `IMPLEMENTED_AND_VERIFIED` requires runtime evidence. UI modules whose APIs and HTML routes passed but whose controls were not driven by a browser are conservatively `IMPLEMENTED_BUT_NOT_VERIFIED`.

| Feature | Status | Evidence / limitation |
|---|---|---|
| Login/session/logout | IMPLEMENTED_AND_VERIFIED | Mongo session, Secure/HttpOnly/SameSite cookie, redirect fix, logout invalidation and API 401 passed. |
| MongoDB | IMPLEMENTED_AND_VERIFIED | Authenticated app-user read/write through Docker; active database confirmed. |
| Worker and heartbeat | IMPLEMENTED_AND_VERIFIED | Startup, FFmpeg, Mongo, polling, leases, failure and stale reclaim exercised. |
| Shared storage | IMPLEMENTED_AND_VERIFIED | Web/worker access plus restart persistence passed. |
| Dashboard | IMPLEMENTED_BUT_NOT_VERIFIED | Live Mongo counts/cost/storage API and HTML route passed; browser UI automation not run. |
| Interactive Help | IMPLEMENTED_BUT_NOT_VERIFIED | Fifteen-step responsive guide, provider-aware warnings, local progress and valid quick-action routes; runtime HTML passed, browser interactions not automated. |
| Subjects / Grades | IMPLEMENTED_BUT_NOT_VERIFIED | Validated CRUD/search/pagination/status UI and live create path; browser controls not automated. |
| Textbooks / Lessons | IMPLEMENTED_BUT_NOT_VERIFIED | Real reference dropdowns, validation, CRUD/detail and Mongo persistence; browser controls not automated. |
| Source documents | IMPLEMENTED_AND_VERIFIED | Runtime TXT upload/hash/storage/attachment plus signature spoof rejection; PDF and DOCX extraction tests pass. |
| Image OCR | MOCK_ONLY | `MOCK_AI=true` returns clearly prefixed MOCK OCR text for pipeline tests; real OCR remains NOT_CONFIGURED. |
| Lesson analysis | IMPLEMENTED_AND_VERIFIED | REAL AI: OpenAI gpt-5.6-luna Responses → Zod → MongoDB → browser reload PASS; 548 input/379 output tokens, cache MISS/HIT, usage, Help badge, Mock/error/budget guards verified. Pricing not configured: paid estimated cost null. [Step 6 evidence](ai-pipeline.md). |
| Script / approval | IMPLEMENTED_AND_VERIFIED | Generation, strict 25–35s validation, edit/status API and approval gate passed. |
| Storyboard | IMPLEMENTED_AND_VERIFIED | Five scenes, valid non-overlap/coverage, persisted video and cache hit passed. |
| Storyboard editor UI | IMPLEMENTED_BUT_NOT_VERIFIED | Edit/add/delete/reorder/regenerate controls exist; route smoke only. |
| Character profiles | IMPLEMENTED_BUT_NOT_VERIFIED | Create and scene/image integration passed runtime; edit/delete guards and browser controls exist but were not driven end-to-end. |
| Style presets | IMPLEMENTED_BUT_NOT_VERIFIED | Create and image prompt/cache integration passed runtime; edit/delete guards and browser controls were not driven end-to-end. |
| Asset library | IMPLEMENTED_AND_VERIFIED | Real placeholder file generation, global matching/reuse, upload validation and safe in-use delete guard. |
| Assign/reuse asset in scene | IMPLEMENTED_BUT_NOT_VERIFIED | API assignment replaces the same asset type, records usage and passed runtime E2E; browser control was not automated. |
| TTS | IMPLEMENTED_AND_VERIFIED | Mock and real Docker VieNeu jobs, 48kHz audio, cache/usage, scene timing and MP4 passed. See [tts.md](tts.md). |
| TTS lifecycle UI | IMPLEMENTED_BUT_NOT_VERIFIED | Dynamic preset selector, async polling, regenerate, retry/cancel and native audio preview implemented; HTTP paths verified, browser interactions not automated. Explicit detach/delete is not exposed. |
| Subtitle | IMPLEMENTED_AND_VERIFIED | Persisted UTF-8 SRT timing and FFmpeg burn-in verified. |
| Subtitle editor UI | IMPLEMENTED_BUT_NOT_VERIFIED | Generate/view/edit/save SRT API passed runtime E2E; Video Studio control was not browser-driven. |
| FFmpeg product render | IMPLEMENTED_AND_VERIFIED | 1080×1920, 30fps, H.264/AAC, 33.342s MP4 opened by ffprobe. |
| Music/SFX mix | IMPLEMENTED_BUT_NOT_VERIFIED | Selection APIs feed FFmpeg attenuation, fade and limiter and final output passed ffprobe; browser controls were not automated. |
| Render queue / Video Studio | IMPLEMENTED_BUT_NOT_VERIFIED | Live jobs, logs, progress, retry/cancel, media ranges and approval API passed; browser controls not automated. |
| Video library/download/delete | IMPLEMENTED_BUT_NOT_VERIFIED | Live list/search/filter, studio link and authenticated download passed runtime; guarded delete and browser controls were not driven. |
| Batch pipeline | PARTIAL | Three-lesson, 21-job pause/resume/cancel passed; full approval-gated three-video completion remains unexecuted. |
| AIUsage/cache/budget | IMPLEMENTED_AND_VERIFIED | Every implemented AI path records use/cache/failure; provider+model keys and pre-call budget guard tested. |
| Cost dashboard | IMPLEMENTED_BUT_NOT_VERIFIED | Daily/monthly/cache/average/budget live metrics implemented; pricing not configured. |
| YouTube mock | IMPLEMENTED_AND_VERIFIED | Returns `MOCK`, `published:false`; stores no fake channel/token/production analytics. |
| YouTube real | NOT CONFIGURED | OAuth/upload/analytics code exists; credentials unavailable, so no success is claimed. |
| Settings | IMPLEMENTED_BUT_NOT_VERIFIED | API persistence and render snapshot/application passed E2E; public privacy requires confirmation; browser form was not automated. |
| Backup/restore | IMPLEMENTED_AND_VERIFIED | Separate-database restore matched source counts; zero restore failures. |
| Analytics | PARTIAL | Live video/render/publishing totals and mock isolation pass; real YouTube sync remains NOT_CONFIGURED. |
| Docker Compose | IMPLEMENTED_AND_VERIFIED | Development and production config/build pass; standard web/Mongo/worker runtime and health passed after image deployment. |

| Docker VieNeu local TTS | IMPLEMENTED_AND_VERIFIED | Two real MP4 E2Es (Default/Trúc Ly), mono 48kHz WAV, usage/cache, cancel/retry, restart and network-none inference PASS. Presets only; [evidence](tts.md). |
| VieNeu browser controls | IMPLEMENTED_AND_VERIFIED | Chrome login, voice selection/persistence, async job polling, cache reuse, WAV play/pause/seek and MP4 preview PASS. Human pronunciation review remains manual. |
