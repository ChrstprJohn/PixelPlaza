# PixelPlaza admin

Current 2026-10-25 note: an automated request check saw Cloudflare challenge 403 responses on the Vercel admin/visits rewrites. The owner reports the normal browser features are working, so that automated result alone does not establish a user-facing outage. No Vercel or Cloudflare routing changes were made. See [the proxy follow-up](VERCEL_PROXY_FOLLOWUP.md) for the observation if it returns.

Open `/admin` on the frontend. The sign-in screen has no logo header or filler sentence; **Back to plaza** sits directly above the form. After sign-in, a dedicated left sidebar places **Admin management** centered beneath the PixelPlaza wordmark, with Lobbies and Analytics links. The page content fills the remaining width with consistent padding; Back to plaza and Sign out stay at the bottom of the sidebar. Signing out asks for confirmation first. On narrow screens a hamburger opens a full-height side drawer from the right with those links and actions.

## Sign in

Set `ADMIN_PASSWORD` in the **backend** environment to a unique 16–256 character password. An optional `ADMIN_SESSION_SECRET` (at least 32 characters) supplies a separate signing key; otherwise the backend derives one from the password. Changing the password invalidates existing sessions. Restart the backend after changing environment variables.

Local development uses the ignored `backend/.env.local`. The existing local admin password is stored there. Never place this password or the session secret in a frontend env file, a `VITE_` variable or Git.

Sign-in creates an eight-hour signed HttpOnly, SameSite=Strict cookie. Production cookies require HTTPS. Password guesses are limited to ten attempts per minute across the backend process; all admin writes require an allowed website Origin and JSON. Admin routes use same-origin `/api/admin` requests; Vite proxies them locally, and `vercel.json` forwards them to the production API. This avoids depending on third-party cookies between Vercel and the API domain.

## Lobby controls

- View live player counts and names, refreshed every five seconds while the page is visible.
- Choose the red **Close lobby** action to block new players, or **Open lobby** to let them join again. A confirmation dialog explains the effect first. Players already inside can remain in a closed lobby.
- Choose **Remove** beside a player to review a confirmation dialog before removing them. Their session ends; removal is not a permanent ban, so they can join again.

Open/closed settings persist in Redis under `pixelplaza:admin:closed:<lobbyId>`. No chat contents, guest tokens or API credentials are returned in admin lists. Player positions and sessions retain their existing restart behavior.

The Analytics section keeps the PixelPlaza PostHog dashboard, following SchedSnap's setup. Set backend-only `POSTHOG_DASHBOARD_EMBED_URL` to the dashboard's shared or embedded link. The admin-only `/api/admin/dashboard` endpoint validates the URL and returns it after sign-in; the browser iframe fills the available content width and follows trusted PostHog height messages on desktop/mobile. A missing link shows setup guidance, and request failures offer retry. The provided dashboard URL is configured in ignored `backend/.env.local` and the VM's existing private `.env.production`. Public visits and lobby/chat usage are tagged `site_name = pixelplaza` and the Vite environment; filter both on production insights. PixelPlaza's admin pages do not initialize its tracking SDK. Current player counts remain under Lobbies. See [the step-by-step embedding guide](posthog/EMBED.md) and [analytics setup](posthog/README.md).

## Deployment

Deployed on 2026-10-15: the VM backend runs application commit `6b4a0e4` from `main`; the frontend is deployed at `https://pixelplaza-live.vercel.app/admin`. The existing local backend `ADMIN_PASSWORD` was originally copied from the then-root `.env.local` (now `backend/.env.local`) to private `~/apps/pixelplaza/.env.production` (mode 600). Its value is not recorded here. The stats deployment preserved that password and added only the server-side PostHog query settings. Compose loads the existing production file through `env_file`; its explicit `HOST` and `PORT` overrides do not override the password. Recreate the backend after changing its environment. The exact frontend origin remains in `FRONTEND_ORIGIN`; Redis, realtime and admin secrets stay out of Vercel.

Production checks from the earlier deployment passed: `/health` returned 200; `/api/admin/session` returned 200 with `configured:true` and `authenticated:false` on both the API hostname and Vercel rewrite. Unauthenticated GET and POST `/api/admin/lobbies` returned 401 through both hostnames. Only the PixelPlaza backend was rebuilt/recreated; Redis data and other services were preserved. Production browser sign-in and management actions were not exercised during that deployment.

## Verification

`npm test` covers unauthorized access, allowed origins, incorrect passwords, signed cookie attributes, expiry/tampering, throttling, persisted lobby closures and removal of guest sessions. `npm run build` checks frontend compilation. On 2026-10-26, the redesigned admin layout loaded locally, showed the lobby confirmation, retained the PostHog dashboard, and was reviewed at desktop and mobile widths. Admin success and error messages now use dismissible bottom-right alerts; the embed no longer shows the extra open-in-new-tab link. Deployment is separate from this local UI change.

Earlier browser checks confirmed sign-in, narrow/desktop layouts, close/reopen, player-list refresh, inline removal confirmation and the analytics placeholder. Both lobbies were left open and the disposable preview guest was removed.
