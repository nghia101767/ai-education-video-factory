# Step 9 verification — Real AI Storyboard Generation

## Result

**IMPLEMENTED_AND_VERIFIED (current implementation)** — 2026-09-12. Real OpenAI, MongoDB, browser reload, cache, edit/save, approval, Video-isolation, and web/worker restart checks passed. The corrected Step 9 implementation does not import, create, update, or return a Video.

## Runtime evidence

- Lesson ID: `6aa485a49e66fcef87df1689`
- LessonAnalysis ID (unchanged): `6aa485ae9e66fcef87df16d8`
- Approved Step-7 Script ID: `6aa515f6ce98a05f40f359bd`
- Final Storyboard ID: `6aa53aeb0c3c1db7afee71a6`, status `approved`
- Provider/model: `openai` / `gpt-5.6-luna`
- Prompt/schema: `storyboard-generation-v1` / `storyboard-schema-v1`
- Output: 6 scenes, 30 seconds, 9:16, 30 fps
- Verified regeneration usage: 1,107 input / 1,745 output tokens, 17,824 ms
- Estimated cost: `null` because production pricing is not configured; no price was invented
- Cache: the same instruction produced a persisted Storyboard cache HIT and a separate zero-cost AIUsage event (token fields null)
- AIUsage: real successful miss and cache-hit records persisted with provider/model/tokens/duration/cache/status/error fields; prior real calls from the run remain additive evidence

The real flow used the existing Step-7 script and performed generate → Mongo reload → forced regenerate with optional instruction → same-instruction cache hit → edit first scene on-screen text → manual save without AI → approve → browser reload. Storyboard Studio showed runtime-verified OpenAI, actual Script-derived readiness (`✨ Sẵn sàng tạo Storyboard` or `Chưa sẵn sàng — cần duyệt kịch bản.`), status, provider/model, duration, 9:16, 30 fps, six timeline cards, narration, visual plan, camera, transition, on-screen text, and editable typed asset requirements. Type/description/role/required plus add/remove controls are schema-compatible. The stored edited requirement survived browser reload.

After `docker compose restart web worker`, authenticated API reads proved the same approved Script and Storyboard IDs, six scenes, edited field, and LessonAnalysis reference persisted. MongoDB and its volume were not reset or deleted.

## Gates and validation

- Missing script: HTTP 404 (`Không tìm thấy kịch bản.`).
- Rejected/unapproved script: HTTP 400 with exact message `Kịch bản phải được phê duyệt trước khi tạo Storyboard.`.
- Structured Zod schema requires sequential unique order from 1, positive/non-overlapping timing, 25–35 second target (30 preferred), final time not beyond target, explicit visual/camera/transition/on-screen text, and Step-10-ready typed asset requirements.
- Budget is checked before provider attempts. Budget blocks cannot save a Storyboard.
- Manual save independently runs Zod and timeline validation and never invokes AI.
- Cache identity includes provider/model/prompt/schema/script content hash/target duration/9:16/30fps/scene-length settings/regeneration instruction.

## Automated checks

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS (48 static/dynamic route entries generated)
- `npm test`: PASS, 47/47
- OpenAI transport tests: Responses API, strict Structured Outputs, independent Zod parse, usage capture, invalid output/retries, provider failures, and pre-call budget block PASS
- Storyboard tests: schema/timeline/assets/cache identity and Mock provider PASS
- Real browser/API E2E: PASS; the full generation sequence completed. A later no-AI review rerun verified approved/rejected/missing gates, both readiness states, asset requirement edit/save/reload, approval, Mongo persistence, and byte-for-byte stable projected Video records before/after (`videoCount: 1`, `openAICalls: 0`). The initial browser scripts each needed one locator-only correction; corrected reruns passed.

## Scope confirmation

The final service has no Video dependency and the corrected browser/API regression proved it neither creates nor mutates Video records. No lesson reanalysis, script generation/regeneration, asset generation, TTS, rendering, publishing, database reset, data deletion, or `docker compose down -v` occurred. The previously generated Step-7 script was only returned to its required approved state before Step 9. Existing unrelated files and data were preserved.

Historical note: the superseded first implementation briefly contained `ensureVideo()` and created draft Video `6aa53aeb9be2633f33208359` during the initial real run. Review removed that coupling. Because the task explicitly prohibited deleting data, the draft record was not deleted; the corrected regression proved its projected identity/title/status/duration/updatedAt remained unchanged. This is a historical run artifact, not behavior of the final implementation.
