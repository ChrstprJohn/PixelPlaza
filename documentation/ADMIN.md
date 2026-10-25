# PixelPlaza admin

Current 2026-10-25 verification: the API admin auth boundary still rejects unauthorized calls, but Vercel same-origin admin rewrites receive Cloudflare challenge 403. Historical browser/admin checks below predate that issue. See [the proxy follow-up](VERCEL_PROXY_FOLLOWUP.md).

Open `/admin` on the frontend. It uses the existing cream, green, Nunito and Pixelify Sans styling, with a simple sign-in form and Lobbies / Analytics navigation.

## Sign in

Set `ADMIN_PASSWORD` in the **backend** environment to a unique 16–256 character password. An optional `ADMIN_SESSION_SECRET` (at least 32 characters) supplies a separate signing key; otherwise the backend derives one from the password. Changing the password invalidates existing sessions. Restart the backend after changing environment variables.

Local development uses the ignored `backend/.env.local`. The existing local admin password is stored there. Never place this password or the session secret in a frontend env file, a `VITE_` variable or Git.

Sign-in creates an eight-hour signed HttpOnly, SameSite=Strict cookie. Production cookies require HTTPS. Password guesses are limited to ten attempts per minute across the backend process; all admin writes require an allowed website Origin and JSON. Admin routes use same-origin `/api/admin` requests; Vite proxies them locally, and `vercel.json` forwards them to the production API. This avoids depending on third-party cookies between Vercel and the API domain.

## Lobby controls

- View live player counts and names, refreshed every five seconds while the page is visible.
- Close a lobby to new players, or reopen it. Existing players can remain inside a closed lobby.
- Remove a player after inline confirmation. Their session ends; removal is not a permanent ban, so they can join again.

Open/closed settings persist in Redis under `pixelplaza:admin:closed:<lobbyId>`. No chat contents, guest tokens or API credentials are returned in admin lists. Player positions and sessions retain their existing restart behavior.

The Analytics tab embeds the PixelPlaza PostHog dashboard, following SchedSnap's setup. Set backend-only `POSTHOG_DASHBOARD_EMBED_URL` to the dashboard's shared or embedded link. The admin-only `/api/admin/dashboard` endpoint validates the URL and returns it after sign-in; the browser iframe fills the available width and follows trusted PostHog height messages on desktop/mobile. A missing link shows setup guidance, and request failures offer retry. The provided dashboard URL is configured in ignored `backend/.env.local` and the VM's existing private `.env.production`. Public visits and lobby/chat usage are tagged `site_name = pixelplaza` and the Vite environment; filter both on production insights. PixelPlaza's admin pages do not initialize its tracking SDK. Current player counts remain under Lobbies. See [the step-by-step embedding guide](posthog/EMBED.md) and [analytics setup](posthog/README.md).

## Deployment

Deployed on 2026-10-15: the VM backend runs application commit `6b4a0e4` from `main`; the frontend is deployed at `https://pixelplaza-live.vercel.app/admin`. The existing local backend `ADMIN_PASSWORD` was originally copied from the then-root `.env.local` (now `backend/.env.local`) to private `~/apps/pixelplaza/.env.production` (mode 600). Its value is not recorded here. The stats deployment preserved that password and added only the server-side PostHog query settings. Compose loads the existing production file through `env_file`; its explicit `HOST` and `PORT` overrides do not override the password. Recreate the backend after changing its environment. The exact frontend origin remains in `FRONTEND_ORIGIN`; Redis, realtime and admin secrets stay out of Vercel.

Production checks passed: `/health` returns 200; `/api/admin/session` returns 200 with `configured:true` and `authenticated:false` on both the API hostname and Vercel rewrite. Unauthenticated GET and POST `/api/admin/lobbies` return 401 through both hostnames. Only the PixelPlaza backend was rebuilt/recreated; Redis data and other services were preserved. Production browser sign-in and management actions were not exercised during this deployment.

## Verification

`npm test` covers unauthorized access, allowed origins, incorrect passwords, signed cookie attributes, expiry/tampering, throttling, persisted lobby closures and removal of guest sessions. `npm run build` checks frontend compilation. Admin UI follows the existing visual theme; its compact room rows stack controls on small screens.

Browser checks confirmed sign-in, narrow/desktop layouts, close/reopen, player-list refresh, inline removal confirmation and the analytics placeholder. Both lobbies were left open and the disposable preview guest was removed.
