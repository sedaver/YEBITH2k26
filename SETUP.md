# Activate YEBETH2k26

The backend implementation is included. Activation requires a Supabase project and a Node/container host. No live project credentials or administrator password have been supplied, so real login and cloud uploads are not activated yet. The earlier private Sites deployment remains the frontend version.

## 1. Connect Supabase

Create a Supabase project. Copy `.env.example` to `.env` in this folder. Fill in the project URL, publishable/anon key, server secret/service-role key, and PostgreSQL connection string. Use the dashboard's session-pooler connection string if your connection requires IPv4. Keep TLS verification enabled. URL-encode special characters in the database password.

Use Node 22.13 or newer (Node 24 is tested). Install dependencies with `npm ci`. Generate the CSRF secret locally:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Put the result in `CSRF_SECRET`. Never put server keys in any `VITE_` variable. `.env` and `.admin-input.json` are ignored by Git and Docker. Avoid sharing secret values in chat.

In Supabase Auth, disable public sign-ups and add your actual application origin plus `/admin/reset-password` to the allowed redirect URLs. Set the Site URL to the application origin. Configure a production SMTP provider for reliable password reset delivery. The default Supabase recovery email link is supported; the reset page reads its recovery token from the URL fragment, clears that fragment, submits the new password to the API, and revokes local sessions.

## 2. Create database and storage

```sh
npm run db:migrate
npm run storage:provision
```

Migrations are transactional, tracked, and protected by an advisory lock. They create an isolated `festival` schema with private tables, indexes, constraints, score views, audit records, and change revisions. Keep this schema out of Supabase's exposed Data API schemas. Browser roles receive no access. Run migrations using the project database owner. The storage command creates the public gallery bucket; anonymous clients can read published photos but receive no upload/delete policy.

Migration `003_program_categories.sql` adds the programme category table and assigns every existing programme to `Other` without changing houses, results, scores, users, gallery items, or audit records. Run `npm run db:migrate` again after pulling this upgrade. Administrators can then recategorize existing programmes from the Events workspace.

For a dedicated runtime database role, have your database administrator grant access only to the `festival` schema, its sequences and tables, and create the corresponding RLS policies for that role. Do not reuse that role's connection for migrations. The default Supabase owner connection works for initial setup but has broader database privileges.

## 3. Create the first administrator

Create a local `.admin-input.json` file with your own details (the values below are placeholders):

```json
{
  "email": "YOUR_ADMIN_EMAIL",
  "name": "YOUR_NAME",
  "password": "YOUR_UNIQUE_PASSWORD_AT_LEAST_12_CHARACTERS",
  "role": "admin"
}
```

Run `npm run admin:create`. Supabase stores the password hash; the application stores only the profile and authorization role. Save the password securely and remove this local input file afterward. Repeat with another email and `"role": "editor"` for a limited account. No default administrator or shared password is created. Existing accounts are not silently overwritten.

## 4. Run locally

```sh
npm run dev
```

The website runs at `http://127.0.0.1:5173` and the API at port 3001. Vite forwards `/api` to the backend. Close any older frontend process using port 5173 first. Use `npm run dev:frontend` and `npm run dev:api` for separate terminals.

Open `/admin/login`, sign in, create houses, create programmes with Individual, Group, Off-Stage or Other categories, and publish results. Programme rankings, category standings and overall standings are all calculated from those result records. A new database contains the school/festival settings only; no fake houses, scores, events or photos are inserted. Development fixtures are optional through `npm run seed`, which requires `ALLOW_DEVELOPMENT_SEED=yes`, a non-production environment, and an empty database.

## 5. Deploy the complete application

Deploy the included Dockerfile to a Node/container host. The Node server serves both the existing website and `/api` on the same origin. The previous Sites deployment is static and does not execute this Node server; uploading only `dist/` will not deploy the backend.

Set server secrets in the host's secret settings. Set `NODE_ENV=production`, `APP_ORIGIN=https://YOUR_DOMAIN`, `ALLOWED_ORIGINS=https://YOUR_DOMAIN`, and `COOKIE_SAME_SITE=lax`. Set `TRUST_PROXY_HOPS` to the exact proxy count used by the host; leave zero without a proxy. Terminate HTTPS at the host and disable response buffering for `/api/live`. Use `/api/health` as the readiness check. Run migrations before starting the new release. Configure database backups and storage retention for the actual provider account.

```sh
npm run build:full
npm start
```

Use a persistent Node service with long-lived HTTP/SSE support. Stateless request-only hosting needs a different live transport. Multiple API instances share sessions, rate counters and database revisions; no sticky session is required. API instances each poll one small revision row once per second while listeners are connected. The frontend also refreshes every 15 seconds as a fallback.

If retaining a separately hosted frontend, set `VITE_API_BASE_URL=https://YOUR_API/api` and `VITE_REALTIME_URL=https://YOUR_API/api/live` before building. Cross-site cookies require `COOKIE_SAME_SITE=none`, HTTPS, exact allowed origins, and browser support for third-party cookies. Same-origin deployment is preferred to avoid that browser dependency.

## 6. Verify the live connection

Local checks: `npm test`, `npm run typecheck`, and `npm run build:full`.

After configuring the real services, use a staging project to check:

1. Correct/incorrect login, logout, expiration, editor restrictions and password reset delivery.
2. Create Red House and Classical Dance; add a 10-point result while a second browser is on Scores. Confirm 10 points appear without refresh.
3. Edit to 15 points, then delete. Confirm 15 and then 0 in the second browser.
4. Upload a ceremony image with its caption. Confirm it appears in another browser's Gallery. Edit metadata and delete it; confirm database metadata and both storage objects are removed.
5. Verify batch upload, invalid/oversized image rejection, filter combinations, pagination, disabled houses, and cancelled events.

Automated tests use a real embedded PostgreSQL engine (PGlite), actual HTTP routes, image decoding, transactions, and a separate SSE client. Supabase authentication and object storage are test adapters; those tests do not establish that a real Supabase account or deployment is working. Real service verification remains pending until connection details are supplied.

References: [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase Auth](https://supabase.com/docs/guides/auth), [storage access controls](https://supabase.com/docs/guides/storage/security/access-control).
# Candidate and item results upgrade

For an existing Supabase installation that already has program categories, run
`server/database/004_candidate_results.sql` in the Supabase SQL Editor before
deploying this version. The incremental migration preserves all existing results
and house points and is safe to rerun. Do not paste npm commands into the SQL Editor.

In **Admin → Events**, create each competition item and choose Individual, Group,
Off-Stage, or Other as its program category. In **Results → Add result**, select
the item type and item, enter the candidate name (or team name for a group),
division, house, position, optional marks scored, and house points awarded.
Use one record per team for group items. Multiple candidates from one house can
have results in the same item and division. Names distinguish those entries;
include a candidate number in the name if two candidates have identical names.

Marks are displayed with the candidate's result. Only **house points awarded**
contribute to the house standings. Existing house-only results remain editable;
edit those records to add candidate details instead of entering the same award twice.
