# Deployment

Use `docker-compose.prod.yml` for production services. MongoDB and media use persistent mounts; Mongo Express is development-only. Set unique `SESSION_SECRET`, `YOUTUBE_CREDENTIAL_KEY`, admin credentials and provider keys. Put the app behind HTTPS and an authenticated reverse proxy until role middleware is extended to every domain operation.

OrbStack development browser URL: `https://web.ai-education-video-factory.orb.local`. Set `APP_URL` and the YouTube callback to that domain. Internal service communication remains `mongodb:27017`; do not route worker or web MongoDB traffic through the OrbStack browser hostname.
