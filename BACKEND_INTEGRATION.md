# Backend/API contract

The TypeScript API matches the existing forms and data schemas. Setup and pending real-provider requirements are in [SETUP.md](./SETUP.md).

## Responses and connections

All endpoints are under `/api`. Success: `{success:true,data:...}`. Error: `{success:false,error:{code,message}}`. The frontend service adapter unwraps success data and displays safe validation messages. No internal stack trace is returned.

`VITE_API_BASE_URL` defaults to `/api`; `VITE_REALTIME_URL` defaults to `/api/live`. These are public addresses only. Server secrets never enter frontend code.

## Endpoints

| Methods | Path | Access / response |
|---|---|---|
| GET | /health | Database readiness |
| GET | /auth/csrf | CSRF token, signed against HttpOnly cookie |
| POST | /auth/login | Email/password; returns authorized profile |
| GET | /auth/session | Profile or null |
| POST | /auth/logout | Revoke server session and clear cookies |
| POST | /auth/reset-password | Send recovery email through Supabase |
| POST | /auth/change-password | Recovery token/new password; revoke sessions |
| GET | /houses | All houses with database totals/ranks; optional active=true |
| GET | /houses/:id | One house |
| POST, PATCH, DELETE | /houses, /houses/:id | Admin only; dependent results prevent deletion |
| GET | /program-categories | Active programme categories in display order |
| GET | /events, /events/:id | Paginated programme / individual event |
| POST, PATCH, DELETE | /events, /events/:id | Admin/editor |
| GET | /results, /results/:id | Paginated results / individual result |
| POST, PATCH, DELETE | /results, /results/:id | Admin/editor |
| GET | /gallery, /gallery/:id | Paginated images / individual image |
| POST | /gallery | Admin/editor; multipart image plus JSON metadata |
| PATCH, DELETE | /gallery/:id | Admin/editor; metadata change or image deletion |
| GET | /leaderboard | Active houses, totals and official ranks |
| GET | /scores/breakdown | House/category score aggregates |
| GET | /scores/program-rankings | Rankings derived per programme; filters: programCategory, eventId |
| GET | /scores/category-standings | House totals for one programCategory, or overall totals |
| GET | /admin/stats | Admin/editor statistics, leaders, five recent results/images |
| GET, PATCH | /settings | Public read, admin-only write |
| GET | /live | Public SSE invalidations; never sends admin data |

Writes require a valid Origin and X-CSRF-Token even during login. The current frontend's public navigation never links to administration. UI hiding is not the authorization boundary: every write endpoint independently validates the session and role.

## Data and validation

Frontend fields remain camelCase, while relational columns use snake_case in the private `festival` schema.

House input: name, six-digit hex color, nullable HTTPS logoUrl, enabled. House totals cannot be submitted. Events: name, art category, programCategory, ISO date, description, status (upcoming/live/completed/cancelled), optional HTTPS imageUrl and venue. Programme categories are normalized in `festival.program_categories`; the initial values are Individual, Group, Off-Stage and Other. Results: eventId, houseId, positive integer position, finite nonnegative points (two decimal places, up to 1,000,000), optional competition division and ISO date. Missing result division uses the event's art category; missing result date uses server time.

Results are unique per event, house and competition category. The model supports one scored entry per house/category in an event; tied houses may share a position. Repeated entries require distinct competition categories or a future participant dimension. Invalid event/house references, disabled houses and cancelled events reject new/edited results. All constraints are rechecked by PostgreSQL.

Official totals are SUM(points) from results whose event is not cancelled. Programme rankings group that same data by event and house; category standings group it by programme category and house; overall standings group it by house. Cancelling an event temporarily excludes its scores everywhere, while restoring it includes them again. Disabled houses retain their history and total but leave public rankings. Ranks share numbers for ties (1,1,3); tied display order is deterministic by name then id. Scores and ranks are never stored as separately mutable totals.

Deleting an event cascades its results and clears its association from gallery metadata; images remain. Deleting a house with results is rejected. Transactions keep score-visible writes, revision changes and audit entries atomic.

## Pagination and filters

Page shape: `{items,nextCursor,total}`. A cursor is a validated opaque-to-the-UI offset string, not a snapshot token; concurrent inserts can shift page boundaries. Sorting always has an id tie-breaker. Default page size 20, maximum 200. Page and cursor both work.

Common filters: search, category, programCategory, date, dateFrom, dateTo, sort. Events add status; results add eventId and houseId; gallery adds eventId. Date-only filters use Asia/Kolkata. Supported sorts: name, date, -date, position, -points, createdAt, -createdAt as applicable. Search terms and every value are parameterized; identifiers and sort columns come only from server allowlists. Counts and page rows share one database statement.

The existing event selection controls request up to 200 events. For larger festivals, add a searchable event picker rather than loading the full programme into every form.

## Gallery

Multipart field `image` contains one image; `metadata` contains `{caption,category,eventId}`. The existing UI submits up to ten selected images individually, so each receives independent confirmation/progress and can be retried.

Limits: JPEG/PNG/WebP, 10 MB, 25 megapixels, no animation. The server checks decoder-reported format against MIME, decodes the entire image, re-encodes it as WebP, strips metadata, and creates a thumbnail (up to 640 pixels). The display image is at most 2560 pixels. UUID storage keys ignore the supplied filename. Four uploads per API instance may process concurrently.

Storage objects use a public Supabase bucket; only the server key writes. Metadata contains actual cloud URLs and object keys, not binary data. Durable cleanup intents recover abandoned uploads and failed deletions. A background job retries unused objects after 15 minutes. Gallery deletion removes metadata immediately, deletes original/thumbnail objects, and queues a retry if storage fails. Multiple API instances can safely retry idempotent cleanup.

## Authentication and authorization

Supabase owns password hashing and verification. Public signup is not used. A provider-authenticated identity must also have an active admin_users profile. Admins manage houses/settings; admins and editors manage events/results/gallery and read statistics.

Sessions use random 256-bit tokens in HttpOnly cookies; only SHA-256 token hashes are stored in PostgreSQL. The default maximum lifetime is eight hours. Login rotates the session, logout deletes it, password changes revoke all user sessions, and disabling a local profile blocks existing sessions immediately. Production cookies use Secure, SameSite and __Host- names. Supabase identity deletion triggers local session revocation while preserving image audit history.

CSRF uses a signed random cookie plus header and explicit origin allowlisting. Login has IP and normalized-email rate limits shared through PostgreSQL. Reset responses do not reveal whether an email exists. Secrets are environment-only. Use production SMTP and Supabase password security settings when provisioning the real project.

## Live updates and operations

A revision row changes within the same transaction as houses/events/results/gallery/settings. API instances poll that row once per second while SSE clients exist, then notify connected clients to fetch authoritative API data. Revision locking avoids out-of-order sequence commits causing missed changes. A reconnect always triggers a refresh. The browser retains a 15-second polling fallback and retries a refresh if a change arrives during a fetch.

Readiness checks query PostgreSQL. Database connections have limits and statement timeouts. TLS terminates at the production host; configure the exact proxy hop count and SSE buffering. Graceful shutdown closes streams, drains HTTP and releases database connections. The maintenance job expires sessions and rate counters and retries storage cleanup. Detailed failures remain in server logs; responses contain safe messages.

## Verification boundary

The automated suite runs real PostgreSQL semantics through PGlite, HTTP requests, transactions, image decoding and an independent SSE connection. Only Supabase password authentication and cloud object storage are substituted inside tests. The frontend schemas validate backend response shapes in those tests.

Real Supabase Auth/Storage, recovery email delivery, TLS/proxy cookies, multi-process database contention and the production host still require staging verification after credentials are configured. No claim of a live production deployment is made.

