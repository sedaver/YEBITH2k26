# Backend integration contract

This is a frontend-only delivery. No backend infrastructure, authentication system, storage, scoring rules or sample records have been added.

## Configure
Edit `services/config.ts`:
- `apiBaseUrl`: HTTPS API base such as `https://api.example.org/v1`. Empty means disconnected preview mode.
- `realtimeUrl`: optional full HTTPS Server-Sent Events URL.
- `pollIntervalMs`: 15000 by default. All active resources refresh while the page is visible and immediately after reconnecting or a successful mutation.
- `requestTimeoutMs`: 15000.

These settings are public. Never include tokens, service-role keys or secrets. All requests use `credentials: 'include'`. Adapt only the service layer if you prefer another backend provider or SDK.

## Authentication
| Method | Path | Response |
|---|---|---|
| GET | /auth/csrf | { csrfToken: string } |
| POST | /auth/login | { user: AdminUser } |
| GET | /auth/session | { user: AdminUser \| null } |
| POST | /auth/logout | 204 |

Login JSON: `{ email, password }`. AdminUser: `{ id: string, name: string, email: string, role: 'admin' }`.
The backend sets and invalidates secure HttpOnly session cookies. Mutations, including login/logout, send `X-CSRF-Token` obtained from /auth/csrf. Do not rotate the CSRF token during the session without updating the frontend adapter to refresh it. No credentials are persisted in browser storage.

Enforce authentication and administrator permissions on every protected endpoint, independently of frontend route guards. Public GET routes may return published data only. Return 401 for expired/invalid sessions, 403 for denied permissions and 409 for conflicts. Do not return internal stack traces.

Use a same-site backend where possible. If cross-origin credentials are necessary, configure CORS for the exact frontend origin, credential support, allowed methods and X-CSRF-Token/Content-Type headers. Configure cookie policies for your deployment.

## Public reads and administration
| Method | Path | Shape / behaviour |
|---|---|---|
| GET | /houses | House[]; include enabled state; public may omit private records |
| PATCH | /houses/:id | accepts name, color, logoUrl, enabled; returns House |
| GET | /events | Page<Event> |
| POST | /events | Event input; returns Event |
| PATCH | /events/:id | Event input; returns Event |
| DELETE | /events/:id | 204; enforce any result-dependency rules server-side |
| GET | /results | Page<Result> |
| POST | /results | Result input; returns Result |
| PATCH | /results/:id | Result input; returns Result |
| DELETE | /results/:id | 204 |
| GET | /gallery | Page<GalleryImage> |
| POST | /gallery | multipart image + metadata; returns GalleryImage |
| PATCH | /gallery/:id | caption, category, eventId; returns GalleryImage |
| DELETE | /gallery/:id | 204; remove record and storage according to backend policy |
| GET | /scores/breakdown | { houseId, category, points }[] |
| GET | /admin/stats | { totalPoints, events, images, results }; admin only |
| GET | /settings | { schoolName, festivalName, description, startDate, endDate } |
| PATCH | /settings | updated settings; returns settings; admin only |

Page<T>: `{ items: T[], nextCursor: string | null, total: number }`.
GET query keys:
- Common: `limit`, `cursor`, `search`, `category`, `sort`.
- Events: `status` = upcoming/live/completed; sort by date or name.
- Results: `eventId`, `houseId`, `date` = YYYY-MM-DD; sort by -date, date, position or -points.
- Gallery: sort by -createdAt (newest first).
- Apply filters before counting, ordering and pagination. Use stable cursors with deterministic tie-breakers. The event options picker requests up to 200 events.
- Requested result/event dates are ISO 8601 instants with timezone offsets. Define date-only filtering consistently in your festival timezone.

## Validated records
The authoritative frontend schemas are in `services/models.ts`.

House: id, name, color (six-digit hex), logoUrl (HTTP(S) or null), points (finite number), enabled (boolean).
Event: id, name, category, date, description, status; optional imageUrl, venue, resultCount.
Result: id, eventId, eventName, category, houseId, position (positive integer), points, date; optional updatedAt. On write, eventName is resolved by the backend, not sent by the form.
GalleryImage: id, url, caption, category, eventId (string or null), createdAt; optional thumbnailUrl, eventName, width, height.
Settings startDate/endDate are nullable strings.

The frontend never recalculates house totals from results. The backend must atomically update totals/breakdowns and emit invalidations after adding, editing or deleting results. Tied houses display the same rank.

## Gallery uploads
POST /gallery uses FormData:
- `image`: binary File
- `metadata`: JSON string with caption, category, eventId (nullable)

The frontend permits JPEG, PNG and WebP, 10 MB per image and 10 files per batch. It uploads each file with real XHR byte progress, preserves unsuccessful selections for retry, and only marks success after the backend confirms a valid GalleryImage response. Revalidate MIME signatures, dimensions, file sizes, metadata, authentication and access server-side. Store images in your existing/future image storage and return HTTP(S) URLs; provide thumbnails for efficient galleries.

House logos and event artwork currently use backend-hosted URLs in their edit forms. The gallery uploader is the multi-image upload interface.

## Real-time updates
An optional authenticated EventSource listens for ordinary messages or named events:
`houses`, `scores`, `results`, `events`, `gallery`, `settings`.
Each event invalidates active resource caches; the frontend fetches the authoritative data. EventSource automatically reconnects; polling continues as a fallback. Do not put credentials into SSE query strings. Edits and deletions must emit invalidations too.

## Error and permission handling
Reads have a 15-second timeout, retry controls, skeletons, waiting states and cached data. Invalid response shapes are rejected instead of being rendered as real records. Uploads time out after 60 seconds. Protected operations require the server to enforce the session and role.

## Acceptance checks when your backend is ready
1. Configure the API and verify anonymous public reads and server-enforced administrator writes.
2. Log in with a real authorised account; reload /admin; log out; verify expired sessions return to login.
3. Add/edit/delete a result and verify atomic points, ranking, chart and breakdown updates.
4. Upload multiple valid images; confirm thumbnails, captions and filters; retry a failed upload without duplicating completed files.
5. Edit a house colour and verify public standings and result accents change.
6. Test event status changes, dates, filtering, sorting and cursor pagination.
7. Test SSE invalidation and reconnect; confirm polling continues when SSE is unavailable.
8. Validate the real deployment's CORS, CSRF, cookies, rate limits, sanitisation and permissions.

