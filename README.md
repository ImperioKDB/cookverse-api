# CookVerse API

Fastify + TypeScript backend — Phase 0 foundation only (health checks, auth-verified profile endpoints). See `../08-phase-0-roadmap.md` in the design package for the full stage-by-stage build plan this scaffold implements.

## Setup

```bash
npm install
cp .env.example .env   # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REDIS_URL
npm run dev
```

Then confirm:
- `GET /health` → `{ "status": "ok" }`
- `GET /health/deep` → checks Supabase and Redis are actually reachable, not just that the process is up
- `GET /v1/profiles/:username` → public profile lookup
- `GET /v1/profiles/me`, `PATCH /v1/profiles/me`, `GET /v1/me/echo` → all require `Authorization: Bearer <supabase-access-token>`

## Structure

```
src/
├── plugins/       # supabase, redis, auth, rate-limit, error-handler
├── modules/       # one folder per domain (health, profiles — more land in later phases)
├── app.ts         # Fastify instance assembly
└── server.ts      # entrypoint
```

New domains (recipes, videos, social, ...) each get their own `modules/<name>/` folder with the same four-file shape as `profiles`: `.routes.ts`, `.service.ts`, `.repository.ts`, `.schema.ts` — see `../05-folder-structure.md` for the full target layout once more modules exist.

## Deploying to Render

Build command: `npm install && npm run build`. Start command: `npm start`. Set the three env vars above (plus `CORS_ORIGIN` to your Vercel frontend URL) in Render's dashboard — never commit `.env`.
