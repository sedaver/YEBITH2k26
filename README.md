# YEBETH2k26 · GHS BEENCHI

The existing festival frontend is connected to a TypeScript/Express backend, PostgreSQL, Supabase Auth and Supabase Storage. The public design is preserved.

## Activation status

Backend code, migrations, frontend integration and local tests are included. Real Supabase credentials and a Node hosting target have not been supplied. Live administrator login, real cloud uploads and production deployment remain pending. The earlier private Sites URL still serves the previously published frontend.

Start with [SETUP.md](./SETUP.md). Put secrets in a local ignored `.env`, apply migrations, provision storage, and create your administrator account before running the application.

## Commands

- `npm ci` — install dependencies
- `npm run db:migrate` — apply transactional PostgreSQL migrations
- `npm run storage:provision` — create/update the Supabase gallery bucket
- `npm run admin:create` — create a real Supabase user and authorized admin profile
- `npm run dev` — local frontend and backend
- `npm test` — HTTP/database/auth boundary/image/live notification integration tests
- `npm run typecheck` — check frontend and backend TypeScript
- `npm run build:full` — build both applications
- `npm start` — run the built Node server (set NODE_ENV=production to serve dist)

Node 22.13+ is required; verification used Node 24. No sample festival records enter the production flow. Optional development seeding requires explicit environment opt-in.

## Source map

- `app/`, `components/festival/`, `admin/` — existing website and administration interface
- `services/` — frontend API contracts, sessions, uploads, cache and live updates
- `server/app.ts` — HTTP endpoints and request middleware
- `server/database/` — SQL schema, migrations, authoritative scores and repository
- `server/auth/`, `server/middleware/` — Supabase password authentication, server-side sessions, authorization, CSRF and rate limits
- `server/storage/` — verified image decoding, WebP optimization, thumbnails and cleanup
- `server/realtime/` — shared database revision notifications over SSE
- `server/tests/` — actual API/SQL tests with isolated external-provider adapters
- `Dockerfile` — same-origin website/API container deployment

Admin links remain absent from public navigation. Administrators use `/admin/login`; forgotten passwords use `/admin/reset-password`. All admin writes require a server-validated session and role.

Read [BACKEND_INTEGRATION.md](./BACKEND_INTEGRATION.md) for endpoint shapes, scoring rules, and operational behavior. The hero remains original AI-generated illustrative artwork; see [ASSETS.md](./ASSETS.md).

