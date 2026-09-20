# YouTube

Register `https://web.ai-education-video-factory.orb.local/api/youtube/oauth/callback` and use the same HTTPS origin in `APP_URL` and `YOUTUBE_REDIRECT_URI`. Middleware uses `INTERNAL_APP_URL=http://web:3000` only for server-side session checks.

Real mode requires `YOUTUBE_PROVIDER=youtube`, client ID, client secret, OAuth-state secret and a non-default `YOUTUBE_CREDENTIAL_KEY`. Access/refresh tokens are AES-256-GCM encrypted, excluded from normal queries and never returned to the browser. OAuth state is HMAC validated.

Only approved rendered videos may upload. Default privacy is `private`; `public` requires an explicit confirmation field. Mock mode returns `published:false`/`mock_completed`, stores no fake channel or published result, and mock analytics previews are not persisted.

Current environment: real OAuth, upload and analytics are **NOT CONFIGURED**.
