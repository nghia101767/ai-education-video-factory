# Factory VieNeu service

Built by `docker/tts/Dockerfile`, started as Compose service `tts`.
Uses official VieNeu 3.6.4 on CPU/ONNX, one persistent model and one inference at a time.
No Python process is spawned by Node and no TTS port is published to the host.

The authoritative installation, API, cache, test and performance guide is [docs/tts.md](../../docs/tts.md).
After editing dependency pins run `uv lock --project services/vieneu`; Docker reproduces that lock with `uv sync --frozen`.

Internal API:

- GET /health — actual model/dependency/storage readiness; 503 until ready.
- GET /voices — preset labels/IDs from the SDK.
- POST /generate — text, optional voice (default), optional safe WAV filename.
  Returns relative audioPath, actual duration, sampleRate, channels, codec, fileSize, inferenceMs, RTF and peak RSS.
  The file is atomically committed before success. Caller handles cache.

Reference audio and speed changes are explicitly rejected until supported by the integration.
All synthesis uses local ONNX; first startup downloads model/codec into HF_HOME.
