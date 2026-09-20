# Development

Browser URLs are `http://localhost:3000` and `https://web.ai-education-video-factory.orb.local`. Worker identity is `worker.ai-education-video-factory.orb.local`, but services communicate through Compose DNS: web/worker → `mongodb:27017`, and middleware → `http://web:3000`.

Start without deleting data:

```sh
docker compose config
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100 web worker mongodb
```

The active database is `ai_education_video_factory`. Never remove the Mongo volume or current `storage/`. Create the configured admin lazily by logging in with `ADMIN_EMAIL`/`ADMIN_PASSWORD`; only the matching configured account can be created.

Mock development uses `MOCK_AI=true` or per-provider `mock`. Generated SVG/WAV assets and API messages are visibly marked MOCK. Image source documents use explicitly prefixed `[MOCK OCR]` text only when `MOCK_AI=true`; real mode remains `OCR_NOT_CONFIGURED`.

Runtime smoke commands:

```sh
npm run test:e2e-runtime
npm run test:batch-runtime
scripts/backup-mongodb.sh
scripts/restore-mongodb.sh backups/<archive> ai_education_video_factory_regression_restore_<timestamp>
```
