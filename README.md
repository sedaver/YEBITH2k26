# YEBETH2k26 · GHS BEENCHI
Premium responsive school arts festival frontend. React 19, TypeScript, Vite, Radix/Shadcn primitives, and Lucide icons.

## Start
Requires Node.js 22.13 or newer.
```sh
npm ci
npm run dev
```
Open the local address printed by the server (normally http://127.0.0.1:5173).

```sh
npm run typecheck
npm run build
npm run preview
```
The production website is generated in `dist/`. Any static host must route unknown page paths to `index.html`. The included `public/_redirects` supplies the common SPA fallback.

## Pages
- / — festival home
- /scores — standings, comparison chart and points breakdown
- /events — searchable, filterable programme with event details
- /results — filters, sorting and responsive results table
- /gallery — paginated, category-filtered gallery with keyboard/swipe/fullscreen lightbox
- /about — festival story
- /admin/login — future backend sign-in
- /admin — administration overview
- /admin/houses, /admin/events, /admin/results, /admin/gallery, /admin/settings

## Current connection state
The backend does not yet exist, as confirmed in the brief discussion. This delivery contains **no database, fake login, sample house scores, seeded results or fabricated event photographs**.
Public information has intentional waiting states. The admin workspace is clearly labelled **Interface preview** when `apiBaseUrl` is empty. You can explore forms, choose local image files and edit their upload metadata, but saving and uploading are disabled.

Once `apiBaseUrl` is configured, preview access is automatically removed. The admin workspace checks the real session before loading protected resources. Permissions must also be enforced by the backend.

## Connect the backend
Read [BACKEND_INTEGRATION.md](./BACKEND_INTEGRATION.md). Configure `services/config.ts`, implement the documented contract, or adapt the services to your own API/SDK. All dynamic requests are in `services/`.

## Source map
- `app/frontend.tsx`: app entry, route selection, metadata and lazy admin loading
- `app/globals.css`: shared design tokens and responsive styles
- `components/festival/`: reusable public components and data views
- `admin/`: protected workspace, forms and image uploader
- `services/`: validated data models, auth, HTTP, uploads, caching and updates
- `components/ui/`: accessible shared interface primitives

## Image
The hero is original AI-generated illustrative artwork, not a photograph from GHS BEENCHI. It is identified as festival artwork and is never inserted into the event gallery. See [ASSETS.md](./ASSETS.md).

## Verification and limits
TypeScript and the production build have been checked. Desktop/mobile navigation, admin preview, dialogs, upload previews and the result-entry WebMCP tool have been reviewed. Live authentication, backend permissions, real-time messages, and successful persistence cannot be end-to-end tested until the backend exists.

