# Production readiness

Verdict: **NOT READY**.

Ready and runtime-verified in mock mode: authentication, API authorization, MongoDB, shared persistent storage, curriculum/source pipeline, Character/Style integration, manual asset assignment, AIUsage/cache/budget behavior, editable SRT, worker leases/recovery, music/SFX FFmpeg render, video download/approval and backup/isolated restore.

Release blockers:

- Real OpenAI and YouTube credentials are absent; real LLM/image/TTS/OAuth/upload/analytics are `NOT CONFIGURED`.
- Full browser-driven interaction E2E has not run.
- Three-lesson pause/resume/cancel passed, but a complete three-video run through both manual approval gates has not run.

Docker note: initial dependency fetch attempts hit transient registry `ECONNRESET`/idle timeouts. Both the standard production Compose build and the exact development `docker compose build` subsequently passed; the standard images were deployed and runtime-tested.

Required final checks after configuring secrets:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
docker compose config
docker compose build
docker compose up -d
docker compose ps
npm run test:e2e-runtime
```

Never use `docker compose down -v` for this project. YouTube defaults to `private`; public upload requires explicit confirmation.
