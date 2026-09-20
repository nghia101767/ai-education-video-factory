"""Internal Docker HTTP service. One persistent ONNX engine, bounded inference."""
import contextlib
import json
import os
from pathlib import Path
import resource
import subprocess
import sys
import time
import uuid
import asyncio
import logging
import threading
import re
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

ROOT = Path(os.environ.get("STORAGE_ROOT", "./storage")).resolve()
os.environ.setdefault("HF_HOME", "/app/model-cache")
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
_engine = None
_startup_ms = 0
_ready = False
_error = "VIENEU_INITIALIZING"
_lock = threading.Lock()
logging.basicConfig(level=logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
log = logging.getLogger("tts")


def get_engine():
    global _engine, _startup_ms
    if _engine is None:
        started = time.monotonic()
        log.info("[TTS] loading model; cache=%s", "existing" if any(Path(os.environ["HF_HOME"]).glob("hub/models--*/snapshots/*")) else "download required")
        subprocess.run(["espeak-ng", "--version"], check=True, capture_output=True)
        from vieneu import Vieneu
        _engine = Vieneu(mode="v3turbo", backend="onnx", device="cpu", precision="fp32")
        (ROOT / "audio").mkdir(parents=True, exist_ok=True)
        _startup_ms = round((time.monotonic() - started) * 1000)
        log.info("[TTS] model ready backend=onnx startupMs=%s", _startup_ms)
    return _engine


def handle(request):
    engine = get_engine()
    if request.get("operation") == "health":
        return {"status": "ok", "provider": "vieneu", "available": True, "model": "VieNeu-TTS-v3-Turbo",
                "backend": engine.backend, "sampleRate": engine.sample_rate,
                "startupMs": _startup_ms,
                "voices": [{"id": "default", "label": "Default"}] +
                [{"id": key, "label": label} for label, key in engine.list_preset_voices()]}
    text = request.get("text")
    if not isinstance(text, str) or not text.strip() or len(text) > 10000:
        raise ValueError("TTS_INVALID_TEXT: narration must contain 1–10000 characters")
    if request.get("referenceAudio") or request.get("referenceText"):
        raise ValueError("TTS_INVALID_REFERENCE: cloning is not enabled in phase 1")
    if request.get("speed", 1) != 1:
        raise ValueError("TTS_CONFIGURATION: Turbo does not support speed")
    filename = request.get("filename", "")
    if not isinstance(filename, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.wav", filename):
        raise ValueError("TTS_INVALID_OUTPUT: safe WAV filename required")
    voice = request.get("voice", "default")
    if not isinstance(voice, str) or len(voice) > 100 or (voice != "default" and voice not in dict((key, label) for label, key in engine.list_preset_voices())):
        raise ValueError("TTS_INVALID_VOICE: unknown preset")
    target = ROOT / "audio" / filename
    temporary = target.with_name(f".{uuid.uuid4().hex}.wav")
    started = time.monotonic()
    try:
        log.info("[TTS] inference started voice=%s; cache handled by worker", voice)
        audio = engine.infer(text=text, voice=None if voice == "default" else voice)
        import numpy as np
        if audio.size == 0 or not np.isfinite(audio).all() or float(np.max(np.abs(audio))) < 0.0001:
            raise ValueError("TTS_INVALID_AUDIO: empty, silent or nonfinite waveform")
        engine.save(audio, str(temporary))
        probe = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format",
                                "-of", "json", str(temporary)], capture_output=True, text=True, check=True)
        data = json.loads(probe.stdout)
        stream = next(s for s in data["streams"] if s["codec_type"] == "audio")
        duration = float(data["format"]["duration"])
        if duration <= 0 or int(stream["sample_rate"]) != 48000 or int(stream["channels"]) != 1:
            raise ValueError("TTS_INVALID_AUDIO: unexpected WAV format")
        os.replace(temporary, target)
        elapsed = round((time.monotonic() - started) * 1000)
        rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        log.info("[TTS] inference completed duration=%s inferenceMs=%s output=%s", duration, elapsed, filename)
        return {"success": True, "audioPath": f"audio/{filename}", "duration": duration, "sampleRate": int(stream["sample_rate"]),
                "channels": int(stream["channels"]), "codec": stream["codec_name"],
                "fileSize": target.stat().st_size, "inferenceMs": elapsed,
                "startupMs": _startup_ms, "rtf": elapsed / 1000 / duration,
                "peakRssMB": rss / (1024 * 1024 if sys.platform == "darwin" else 1024)}
    finally:
        temporary.unlink(missing_ok=True)


def initialize():
    global _ready, _error
    try:
        if os.environ.get("VIENEU_CONCURRENCY", "1") != "1":
            raise ValueError("Only benchmarked concurrency 1 is supported")
        get_engine()
        _ready, _error = True, ""
    except Exception as error:
        _error = "VIENEU_NOT_AVAILABLE" if isinstance(error, (ImportError, FileNotFoundError)) else "VIENEU_MODEL_ERROR"
        log.error("[TTS] startup failed: %s (%s)", _error, type(error).__name__)


@contextlib.asynccontextmanager
async def lifespan(_app):
    log.info("[TTS] startup")
    threading.Thread(target=initialize, daemon=True).start()
    yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/health")
def health():
    if not _ready:
        return JSONResponse({"status": "unavailable", "available": False, "provider": "vieneu", "backend": "onnx", "code": _error}, status_code=503)
    try:
        subprocess.run(["espeak-ng", "--version"], check=True, capture_output=True, timeout=5)
        probe = ROOT / "audio" / f".health-{uuid.uuid4().hex}"
        try:
            probe.write_bytes(b"ok")
        finally:
            probe.unlink(missing_ok=True)
        return handle({"operation": "health"})
    except Exception:
        return JSONResponse({"status": "unavailable", "available": False, "code": "VIENEU_NOT_AVAILABLE"}, status_code=503)


@app.get("/voices")
def voices():
    if not _ready:
        return JSONResponse({"error": _error, "code": _error}, status_code=503)
    return {"voices": handle({"operation": "health"})["voices"]}


def generate_locked(body):
    if not _lock.acquire(blocking=False):
        return JSONResponse({"error": "Inference busy; retry with backoff", "code": "TTS_PROCESS_ERROR"}, status_code=503)
    try:
        return handle(body)
    except ValueError as error:
        safe = str(error) if str(error).startswith("TTS_") else "Invalid TTS input"
        return JSONResponse({"error": safe, "code": "TTS_INVALID_INPUT"}, status_code=422)
    except Exception as error:
        code = "VIENEU_NOT_AVAILABLE" if isinstance(error, (ImportError, FileNotFoundError)) else "TTS_PROCESS_ERROR"
        log.error("[TTS] request failed: %s (%s)", code, type(error).__name__)
        return JSONResponse({"error": code, "code": code}, status_code=503)
    finally:
        _lock.release()


@app.post("/generate")
async def generate(request: Request):
    if not _ready:
        return JSONResponse({"error": _error, "code": _error}, status_code=503)
    raw = await request.body()
    if len(raw) > 65536:
        return JSONResponse({"error": "Input too large", "code": "TTS_INVALID_INPUT"}, status_code=413)
    try:
        body = json.loads(raw)
        if not isinstance(body, dict):
            raise ValueError()
        if set(body) - {"operation", "text", "voice", "speed", "referenceAudio", "referenceText", "filename"}:
            raise ValueError()
        if body.get("operation", "synthesize") != "synthesize":
            raise ValueError()
        body.setdefault("filename", f"{uuid.uuid4().hex}.wav")
    except (ValueError, TypeError):
        return JSONResponse({"error": "Invalid request", "code": "TTS_INVALID_INPUT"}, status_code=422)
    return await asyncio.to_thread(generate_locked, body)
