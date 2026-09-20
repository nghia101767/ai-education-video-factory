FROM python:3.12.12-slim-bookworm
COPY --from=ghcr.io/astral-sh/uv:0.11.1 /uv /usr/local/bin/uv
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg espeak-ng libsndfile1 curl ca-certificates && espeak-ng --version && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY services/vieneu/pyproject.toml services/vieneu/uv.lock ./
RUN uv sync --frozen --no-dev && .venv/bin/python -c "import vieneu, onnxruntime; print('VieNeu OK', onnxruntime.__version__)"
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1 STORAGE_ROOT=/app/storage HF_HOME=/app/model-cache
COPY services/vieneu/main.py ./main.py
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
