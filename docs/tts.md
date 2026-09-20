# Vietnamese TTS — VieNeu in Docker

## Architecture

`web → MongoDB Job(tts_generation) → Node worker → http://tts:8000/generate → shared storage/audio → Asset → subtitle → FFmpeg`.

The existing `TTSProvider.synthesize` interface, generic Job queue, Asset/AssetUsage records, SHA256 cache and AIUsage are reused. Python runs only in the internal `tts` container. No TTS host port, cloud speech API, Docker socket, CUDA, PyTorch or NVIDIA runtime is required. The SDK model stays in memory. One inference runs at a time; excess requests return a retryable 503.

## Versions and source

Inspected official [VieNeu source](https://github.com/pnnbao97/VieNeu-TTS/tree/3206ed960e317e69bfe09f9d553aecbf1090f32e) and its `factory.py`, `v3turbo.py`, `onnx_runtime_lite.py` and upstream lock.

- Python image: `python:3.12.12-slim-bookworm`, native Linux ARM64 on Mac M2/OrbStack.
- VieNeu PyPI package: `vieneu==3.6.4`.
- ONNX Runtime: `1.24.4`, matching upstream Python 3.12 lock.
- uv: `0.11.1`; FastAPI `0.135.2`; Uvicorn `0.42.0`.
- All transitive Python dependencies and hashes: `services/vieneu/uv.lock`. Docker uses `uv sync --frozen --no-dev`.
- Debian eSpeak NG, libsndfile and FFmpeg are installed and eSpeak/import checked during build. Debian security updates remain enabled.
- Model: `pnnbao-ump/VieNeu-TTS-v3-Turbo`, `onnx_update` FP32; codec: `OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX`. SDK uses the repositories' main revisions on first fetch. Dependency pinning does not pin remote model revisions; retain the named cache volume for reproducibility and set offline mode after initialization.

SDK calls: `Vieneu(mode="v3turbo", backend="onnx", device="cpu", precision="fp32")`, `list_preset_voices()`, `infer(text=..., voice=...)`, `save(audio, path)`.

## Configuration and installation

Set in the existing `.env` (keep MongoDB credentials unchanged):

```dotenv
TTS_PROVIDER=vieneu
MOCK_AI=false
AI_LLM_PROVIDER=mock
AI_IMAGE_PROVIDER=mock
VIENEU_TTS_URL=http://tts:8000
VIENEU_CONCURRENCY=1
VIENEU_VOICE=default
VIENEU_TIMEOUT_MS=900000
VIENEU_OFFLINE=0
```

LLM/image may remain mock for local pipeline testing. Speech is real when TTS_PROVIDER=vieneu and MOCK_AI=false. MOCK_AI=true overrides all providers; TTS_PROVIDER=mock selects only mock speech. The old AI_TTS_PROVIDER remains a fallback for existing environments.

```bash
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100 tts worker
docker compose exec tts python --version
docker compose exec tts espeak-ng --version
docker compose exec tts python -c "import vieneu; print('VieNeu OK')"
docker compose exec tts curl -fsS http://localhost:8000/health
```

Do not delete volumes or reset MongoDB. Initial model download can exceed 15 minutes on a slow connection; inspect logs before queuing jobs. Worker starts independently, warns when TTS is unavailable and retries transient job errors (maximum three attempts with exponential backoff). A failed job can be retried after service recovery.

## Storage and cache

All three services share the existing `./storage:/app/storage` bind mount. Outputs are safe generated filenames under `storage/audio`, written atomically after waveform checks and ffprobe validation. HTTP returns the relative path and measured duration, sample rate, channels, codec and size. Web preview uses the existing range-capable media URL; React does not hold the WAV bytes.

The named `vieneu-model-cache` volume mounts at `/app/model-cache`; `HF_HOME` directs Hugging Face there. It persists across container restarts. Startup logs distinguish an existing snapshot cache from a download requirement.

On this OrbStack environment, hf-xet stalled on the backbone (0-byte partial file for over 11 hours). Compose therefore sets `HF_HUB_DISABLE_XET=1` and `HF_HUB_DOWNLOAD_TIMEOUT=60`, using the Hub HTTP download path. Existing downloaded files remain reusable. These switches are documented in the [Hugging Face environment reference](https://huggingface.co/docs/huggingface_hub/package_reference/environment_variables). HTTP request logging is disabled to avoid logging signed download URLs.

Observed model revisions: Turbo `8b7e9cffb4b41918cb638b9f62f0a751184d14a6`; codec `ceff0d0749bfb3fa2d61149794ec6feef0d1e1ae`. Backbone is 415,319,040 bytes. The SDK also downloads speaker/denoiser artifacts. Final cache measured 581 MiB; this includes metadata and an abandoned zero-byte partial file.

Worker checks Asset metadata cache first, validates the file with ffprobe, then checks its file cache before calling HTTP. The cache key includes provider, model, voice, original text, language and supplied synthesis/reference settings. A missing/corrupt file is regenerated. Regenerate bypasses reuse and creates a new file. AIUsage uses the project's existing operation `tts_generation`, `provider=vieneu`, `providerType=local`, actual audioSeconds, cached flag and estimatedCost=0. No cloud budget is consumed.

## Voice and UI

Approve script → generate storyboard/images → choose Voice → Generate/reuse voice. The selector is populated from the running SDK through the health/voices API. Polling survives a page reload. Retry and cancel use the existing Job records. Native audio controls provide play, pause and seek; metadata shows voice, provider, seconds and kHz.

Turbo has no speed argument that changes speech rate. Speed is deliberately not exposed. Voice cloning is phase 2: the provider request type reserves referenceAudio/referenceText/referenceAudioHash, but the service rejects reference input until a dedicated validated reference asset workflow is implemented. No reference is silently ignored. Emotion cues are never automatically inserted; user narration passes unchanged.

## Queue, timing and failures

`POST /api/scripts/:id/audio` returns 202 with jobId. `GET /api/jobs/:id` returns status/results; POST with action retry/cancel manages failed or active TTS jobs. `GET /api/scripts/:id/audio` discovers the latest job. Jobs use the project's lowercase queued/processing/completed/failed/cancelled states.

Each generated Asset records script/job, voice, inputText, cacheKey and measured audio metadata. The worker checks job ownership/cancellation before attaching results. Cancellation stops publication of new results at the next checkpoint; an already running HTTP inference can finish and leave a reusable unassigned file. Inference is not killed mid-write.

All scenes must finish before their audio is assigned and the timeline updated. VieNeu scene lengths use actual WAV duration; SRT is regenerated afterward. Real speech may exceed the estimated 25–35 seconds; the render path allows measured VieNeu timing while preserving the existing mock/cloud duration rule. FFmpeg resamples to 48 kHz AAC and maps the narration stream.

- TTS_PROCESS_ERROR / VIENEU_INITIALIZING: bounded retry for connection, busy service, timeout or temporary I/O errors.
- VIENEU_NOT_AVAILABLE / VIENEU_MODEL_ERROR: fix dependency/model and retry explicitly.
- TTS_INVALID_* / TTS_CONFIGURATION: correct text, voice, output or configuration first.
- Worker lease heartbeats continue while HTTP inference is running. Restarted workers reclaim expired jobs through the existing queue.

## Health and troubleshooting

Internal `GET /health` returns 200 only after model loading, eSpeak and writable audio storage checks. During initialization/failure it returns 503. Health stays responsive during inference. `GET /voices` returns SDK presets. Authenticated application endpoints: `/api/health/tts`, `/api/tts/voices`.

If TTS will not start: inspect `docker compose logs tts`, Python/package versions, model cache and available RAM. If worker cannot connect: check `VIENEU_TTS_URL=http://tts:8000`, Compose network and service health. Do not use localhost from worker to reach TTS.

If eSpeak fails: run `docker compose exec tts espeak-ng --version`. If audio is missing: inspect TTS and worker logs and shared storage permissions. If render has no speech: ffprobe the WAV and MP4, check the assigned audio Asset, and inspect FFmpeg mapping in the RenderJob logs.

To test offline after warming cache: set VIENEU_OFFLINE=1 and recreate only tts. The developer's existing `.env` now uses this mode. A separate container with `--network none` and the same model cache was also tested successfully; see evidence below. Fresh installations must use VIENEU_OFFLINE=0 for their first download.

## Tests and performance

```bash
npm run typecheck
npm run lint
npm run build
npm test
docker compose exec -T tts python < scripts/test-vieneu-tts.py
docker compose exec worker ffprobe -v error -show_streams -show_format /app/storage/audio/test-vieneu.wav
docker compose exec worker node tests/runtime-vieneu.mjs
docker compose exec -e E2E_VOICE="Trúc Ly" worker node tests/runtime-vieneu.mjs
docker compose exec worker node tests/runtime-tts-jobs.mjs
docker compose restart tts
docker compose restart worker
```

The real E2E test logs in, creates additive lesson/script data, approves, generates images, queues real speech, tests reuse, renders MP4, checks media streams, preview ranges and subtitle timing. It saves evidence to `storage/logs/vieneu-e2e.json`. It never deletes existing data. Existing `tests/runtime-e2e.mjs` tests the mock pipeline and now polls asynchronous TTS jobs.

Browser regression (run on the host after the real E2E fixture exists):

```bash
npx playwright install chromium
npm run test:tts-browser
```

Uses `ADMIN_EMAIL`/`ADMIN_PASSWORD` from `.env` and `E2E_BASE_URL` (default `http://localhost:3000`). To use installed Chrome instead, run `E2E_BROWSER_CHANNEL=chrome npm run test:tts-browser`. It signs in through the UI, selects the fixture voice, queues a cache-reuse job, checks polling and voice/status restoration after reload, exercises the native audio element's play/pause/seek methods, and plays the MP4 preview. It writes `storage/logs/vieneu-browser.json` and a screenshot; it never saves credentials or deletes records.

StartupMs is reported by health. Each inference records inferenceMs, duration, RTF and process peakRssMB (MiB, despite the field name).

## Validation status

**PASS — Docker VieNeu, real WAV and real MP4 validated on 2026-09-11.**

| Check | Result / evidence |
| --- | --- |
| Docker build/start | PASS; native Linux aarch64, no published TTS port |
| Python / VieNeu import | PASS; Python 3.12.12, VieNeu 3.6.4, ONNX Runtime 1.24.4; torch absent |
| eSpeak NG | PASS; 1.51 executable in container |
| Model / health / voices | PASS; backend ONNX, 23 SDK presets plus Default |
| Worker → TTS → WAV | PASS; three direct HTTP inferences and two full job pipelines |
| Shared storage | PASS; Python writes, worker ffprobes/renders, web serves authenticated range requests |
| WAV content | PASS; PCM s16le, mono, 48,000 Hz, finite/nonempty/non-silent waveform |
| Cache / AIUsage | PASS; each E2E asserts 5 MISS + 5 HIT, no second inference, actual audioSeconds, providerType=local, all estimatedCost=0 |
| Subtitle / FFmpeg | PASS; generated SRT uses audio timing; H.264 1080×1920 MP4 with AAC mono 48 kHz |
| Restart TTS / worker | PASS; cache retained, health recovers, fresh Trúc Ly jobs and render pass afterward |
| Offline | PASS; new container with --network none loads cached model and generates 4.08s WAV |
| Error handling | PASS; empty text, invalid voice/type, reference input, output traversal and speed return 422; missing model is unavailable; real worker connection failure is classified retryable |
| Cancel / retry | PASS; invalid preset fails after one attempt; cancelled job retries successfully and restores valid cached audio |
| Mock provider | PASS; full existing runtime E2E with async jobs, cache, SRT and MP4 |
| Browser TTS / preview | PASS; Chrome 152.0.7977.84, login, Trúc Ly selection, cache job polling, voice/status restored after reload, WAV play/pause/seek and MP4 playback; no page errors |
| Typecheck / lint / build / unit tests | PASS; 27 tests |

No database reset, dropDatabase, dropUser or volume deletion was performed. Tests added records and generated media.

### Real output evidence

First E2E (Default, SDK voice Minh Quân):

- Lesson `6aa340f88301199fb68f3024`, script `6aa340f88301199fb68f3037`.
- MP4: `storage/videos/render-6aa340f89be2633f33135435-6aa3411f8301199fb68f30e6.mp4`.
- MP4 duration 32.534s; source narration total 32.48s.

E2E after restart with named preset **Trúc Ly**:

- Lesson: `VieNeu Phân số 1789084185500` (`6aa342198301199fb68f3119`).
- Script: `6aa342198301199fb68f312c`; video: `6aa342199be2633f3313618f`.
- Provider: VieNeu-TTS; model: `VieNeu-TTS-v3-Turbo-onnx-fp32-sdk3.6.4`.
- First scene WAV: `storage/audio/d9ea366fe164984d539ec1b268d2432603bf14b9023c611b30762bf42046a73d-c99c1920-d58a-4906-8fe8-cd2ee28df894.wav`, 12.96s, 1,244,204 bytes, mono PCM 48 kHz.
- MP4: `storage/videos/render-6aa342199be2633f3313618f-6aa342468301199fb68f31e4.mp4`, **40.359s**, 818,820 bytes.
- Source narration total 40.32s; container `tts`; second generation CACHE HIT.
- MP4 signal: mean -18.6 dB, peak -2.3 dB. Video/audio duration difference 39ms.
- Subtitle: `storage/subtitles/render-6aa342199be2633f3313618f-6aa342468301199fb68f31e4.srt`.

Standalone sample: `storage/audio/test-vieneu.wav`, 3.52s, 337,964 bytes, default voice.
Offline sample: `storage/audio/test-vieneu-offline.wav`, 4.08s, 391,724 bytes.

Machine-readable reports: `storage/logs/vieneu-http.json`, `vieneu-e2e.json`, `vieneu-offline.json`, `vieneu-job-tests.json`. The E2E report includes every scene WAV and inputText.

### Measured performance

Environment: Mac M2/OrbStack, Linux ARM64, 8 virtual CPUs, Docker memory 8,393,605,120 bytes; concurrency 1; no GPU.

| Measurement | Observed |
| --- | --- |
| First successful load including remaining HTTP model downloads | 412.539s |
| Restart with online metadata checks and cached weights | 8.921s |
| Cached offline load, isolated network-none container | 2.217s |
| Cached offline load, standalone service restart | 1.973s |
| Cached offline load, final full-stack startup | 3.480s |
| Sample inference 1 / 2 / 3 | 4.166s / 3.199s / 3.253s |
| Average sample inference | 3.539s |
| Sample audio durations | 3.52s / 3.60s / 3.52s |
| Sample RTF | 1.184 / 0.889 / 0.924 |
| Sample peak RSS | 1,259–1,359 MiB |
| Full E2E peak RSS | Up to 2,543 MiB |
| Model cache on disk | 581 MiB |

For the tested short-scene workload, allow about 4 GiB of headroom for the TTS container and use at least the tested ~8 GiB Docker environment for the complete stack. These are recommendations based on the measured 2.5 GiB peak, not hard limits or a guarantee for arbitrarily long narration. No low memory cap was imposed.

### Scope and remaining limitations

The browser regression also passed with the default pinned Playwright Chromium 145.0.7632.6. The latest `vieneu-browser.json`/screenshot contain that run; Chrome 152 passed before it.

Preset speech is complete. Voice cloning and Turbo speed controls remain deliberately unavailable. Subtitle timing is at scene boundaries, not word-level forced alignment. The Trúc Ly run exceeds the estimated 25–35s because the complete speech is preserved.

The main E2E is an authenticated HTTP/worker/FFmpeg integration test. An additional browser regression passed on 2026-09-11 using Chrome 152.0.7977.84: UI login, Trúc Ly selection, CACHE HIT job, polling, reload restoration, native WAV playback/pause/seek and MP4 playback. Browser test evidence: `storage/logs/vieneu-browser.json` and `storage/logs/vieneu-browser.png`. It found and fixed the voice selector resetting to Default after reload. Media methods are exercised through the browser DOM, not pixel clicks on platform-specific controls. Human assessment of pronunciation is still required. LLM/image generation was mock for these fixtures; all speech in the reported VieNeu outputs is real local synthesis.
