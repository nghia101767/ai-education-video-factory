# API reference

All `/api/*` routes except health, login/session and the OAuth callback are admin-session protected by middleware. Invalid input returns JSON errors without stack traces.

## Authentication and health

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Validate configured admin and create Mongo-backed session. |
| POST | `/api/auth/logout` | Delete current session and clear cookie. |
| GET | `/api/auth/session` | Return current non-secret user identity. |
| GET | `/api/health` | Mongo, storage, worker heartbeat and provider status. |

## Curriculum and source documents

`GET/POST /api/content/{subjects|grades|textbooks|lessons}` lists/creates with search, status, reference filters and pagination. `GET/PATCH/DELETE /api/content/{resource}/{id}` reads, edits and safely deletes. Referenced parent records cannot be deleted.

`POST /api/content/source-documents/upload` accepts PDF, DOCX, TXT, PNG and JPEG multipart files with optional required lesson association in the UI. It enforces size, extension, MIME signature and traversal protection, persists `UPLOADED → PROCESSING → READY/FAILED`, hashes and extracts content, then attaches the record to its lesson. Images use explicitly labelled mock OCR only under `MOCK_AI=true`; real mode returns `OCR_NOT_CONFIGURED`.

## AI pipeline

| Method | Route | Purpose |
|---|---|---|
| GET/POST | `/api/lessons/{id}/analyze` | Analysis history / cached generation. |
| GET | `/api/lessons/{id}/scripts` | Script history. |
| POST | `/api/lessons/{id}/scripts/generate` | Generate validated 25–35s script. |
| GET/PATCH | `/api/scripts/{id}` | Read/edit allowed script fields. |
| POST | `/api/scripts/{id}/approve` | Approve only a locally valid script. |
| POST | `/api/scripts/{id}/reject` | Reject a script. |
| POST | `/api/scripts/{id}/storyboard` | Generate 5–7 scenes for approved script. |
| GET/POST/PUT | `/api/scripts/{id}/scenes` | List/add/reorder complete scene set. |
| PATCH/DELETE | `/api/scenes/{id}` | Validate edit/delete of a scene. |
| POST | `/api/scenes/{id}/generate-asset` | Match/reuse or generate scene image. |
| POST/DELETE | `/api/scenes/{id}/assets` | Assign/detach a ready reusable asset and maintain usage records. |
| POST | `/api/scripts/{id}/audio` | Match/reuse or synthesize scene audio. |

`GET/POST /api/characters` and `PATCH/DELETE /api/characters/{id}` manage reusable Character Profiles. `GET/POST /api/styles` and `PATCH/DELETE /api/styles/{id}` manage Style Presets. Referenced profiles/presets must be archived instead of deleted.

## Assets, render and video

`GET/POST /api/assets` lists/searches/uploads library assets; `DELETE /api/assets/{id}` refuses in-use assets. `GET /api/media?path=...` streams authorized storage paths and supports audio/video byte ranges.

`GET/POST /api/videos` lists/searches/filters or creates videos from approved scripts. `GET/PATCH/DELETE /api/videos/{id}` reads studio data, edits metadata/background music, or performs a guarded delete. `GET /api/videos/{id}/download` returns only an available rendered MP4. `GET/POST/PUT /api/videos/{id}/subtitles` reads, generates and validates edited SRT. Dedicated approve/reject routes enforce transitions. `POST /api/videos/{id}/render` snapshots complete scene inputs, selected music/SFX and render settings. Render-job list/detail/retry/cancel routes expose queue state, progress and logs. `POST /api/videos/{id}/assets` validates local studio uploads.

## Batch, settings, costs and YouTube

`GET/POST /api/batch` lists or starts the fixed approval-gated pipeline. `GET/PATCH /api/batch/{batchId}` exposes jobs and supports `pause`, `resume`, `cancel`, `retry_failed`.

`GET/PUT /api/settings` reads provider status and persists only non-secret defaults; render defaults are copied into each RenderJob and consumed by FFmpeg. `GET /api/dashboard`, `/api/storage/stats`, `/api/analytics/cost` return live Mongo/storage metrics. `GET/POST /api/analytics` returns live video/render/publishing totals plus real snapshots, or syncs/returns a non-persisted mock preview.

`GET/POST /api/youtube/channels`, OAuth callback and channel delete manage OAuth. `POST /api/videos/{id}/publish` requires an approved rendered video, defaults private and requires explicit public confirmation. Mock mode never reports `published:true`. `GET /api/publishing-jobs` lists real publishing records without tokens.
