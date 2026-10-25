# VM deployment

## Current state

Private realtime migration completed on 2026-10-25. The VM app was fast-forwarded from `6b4a0e4` to runtime source `e60cf53` on `main`, including private-transport support from `7562fe2`. Production guest joins, private token refresh, public WebSocket subscription/chat delivery, movement and auth boundaries passed. The owner also confirmed local browser gameplay before authorizing deployment. Later documentation-only commits can advance the checkout without changing backend runtime source.

Active checkout: `~/apps/pixelplaza`; Compose project `pixelplaza`; installed file `compose.vm.yaml`; ROOT private `.env.production` remains mode 600. Both its env value and an explicit Compose override use `REALTIME_API_URL=http://realtime-server:3000`. Other resolved settings, credentials, networks, mounts and protections were preserved. PixelPlaza has no published host port; Caddy routes `pixelplaza-api.chrbuilds.dev` to port 3001. Backend restarts clear in-memory lobby state, so previous players need to rejoin.

The shared realtime server publishes only VM-loopback `127.0.0.1:4300:3000`; the owner laptop reaches it over SSH. Public realtime `/backend/health`, `/backend/token`, `/backend/publish`, raw `/api`, `/admin` and `/` returned origin 404 after Caddy's backend route was removed. `/connection/websocket` remains public through Cloudflare. Token/publish calls still require project credentials. The project registration helper and per-project VM exports now default to private Docker access; combined local export uses the loopback tunnel URL.

Only PixelPlaza was rebuilt/recreated for the final cutover. Caddy was validated/reloaded; realtime-server, Centrifugo, Caddy, n8n and Redis container IDs remained unchanged. Existing volume data and credential files were preserved. Recovery Compose/Caddy/helper copies are at `~/archive/2026-10-25/pixelplaza-private-cutover-1792941024083339996/`; no secret values belong in these docs or Git.

The repository template's `backend/.env.production` is for new deployments. The installed VM still uses root `.env.production`; do not overwrite that installed Compose file wholesale. New source updates use the targeted commands below and preserve the private realtime override.

## Private realtime migration verification

- All 25 repository tests passed before deployment. Local `check:services` and `check:lobby` passed through the owner tunnel, followed by owner browser gameplay confirmation.
- Deployed app token/publish calls passed over private Docker. Public realtime API routes returned 404 at the origin, while loopback health remained 200 and the loopback-only port mapping stayed intact.
- Production HTTPS-origin checks with two disposable guests in an empty lobby passed join, token refresh, public WSS subscription, chat delivery, movement, heartbeat, forged-session rejection and unauthenticated admin denial. Guests were released and temporary test chat expires normally.
- Public direct API health, lobbies and visits returned 200. The current Vercel frontend bundle already targets the correct public API. No frontend realtime env change is required.
- Post-cutover local `npm run check:services` passed again through the existing owner tunnel, including Redis isolation and public WSS delivery.

Known separate issue: Vercel same-origin `/api/admin/session` and `/api/visits` rewrites receive HTTP 403 with `cf-mitigated: challenge`; direct API routes work. This is another Cloudflare challenge on a server-to-server rewrite, not a failed private realtime deployment. Track [the Vercel proxy follow-up](VERCEL_PROXY_FOLLOWUP.md). Do not describe admin/dashboard-through-Vercel as verified working until it is resolved. No Cloudflare settings or Vercel variables were changed during this cutover.

Local env files remain ignored: backend realtime URL `http://127.0.0.1:4300`, public WSS URL unchanged, frontend API base empty for the local proxy. The owner opens/closes the SSH tunnel; it is required only during local development. Documentation stays locally in the maintained `azure_vm/docs/` structure, not in separate VM-side copies.

## Connect the Vercel frontend

In the Vercel project, set this Production environment variable, then redeploy:

```text
VITE_API_BASE_URL=https://pixelplaza-api.chrbuilds.dev
```

Never add admin, Redis or realtime secrets to Vercel frontend variables. Only public frontend settings belong there: `VITE_API_BASE_URL`, `VITE_POSTHOG_TOKEN` and `VITE_POSTHOG_HOST`. See [the PostHog guide](posthog/README.md) for the analytics values.

Backend-only `POSTHOG_PROJECT_ID`, `POSTHOG_PERSONAL_API_KEY` (read-only `query:read`) and `POSTHOG_API_HOST` are configured in the VM's existing private `~/apps/pixelplaza/.env.production` (mode 600). Never place the personal key in Vercel or a `VITE_` variable. `/api/visits` returns the cached aggregate; active lobby/player totals use the existing `/api/lobbies` endpoint.

Stats deployment verified on 2026-10-15: the previously missing visit route returned 404 because the VM was still running `0baafb1`. After explicit approval, the clean `main` checkout was fast-forwarded to `594d005`, the three private query settings were securely added to the existing production env, and only `pixelplaza` was rebuilt/recreated. Admin credentials, existing Compose/env paths, networks and Redis data were preserved; all unrelated running container IDs were unchanged. Both the API and Vercel `/api/visits` routes returned HTTP 200 with `{ "visits": 29 }` at verification time. Headless Edge confirmed the live landing page displayed 29 total visits, 1 open lobby and 0 active users on desktop/mobile layouts. These values are snapshots, not fixed counts. Admin session checks still reported `configured:true` and `authenticated:false`.

## Update the VM backend

The VM repository uses HTTPS. To pull a later GitHub change and rebuild/restart the backend:

```bash
cd ~/apps/pixelplaza
git pull --ff-only origin main
docker compose -f compose.vm.yaml up -d --no-deps --build --force-recreate pixelplaza
docker compose -f compose.vm.yaml ps
```

Check health with:

```bash
curl -fsS https://pixelplaza-api.chrbuilds.dev/health
curl -fsS https://pixelplaza-api.chrbuilds.dev/api/admin/session
curl -fsS https://pixelplaza-live.vercel.app/api/admin/session
```

Admin deployment verified on 2026-10-15: both session URLs return 200 with `configured:true`; unauthenticated GET and POST `/api/admin/lobbies` return 401 through both domains. The existing local backend password was transferred securely from ignored `.env.local` into VM `.env.production` (mode 600), without recording the value. `ADMIN_PASSWORD` must be 16–256 characters. `compose.vm.yaml` uses `env_file: [.env.production]` and explicitly overrides only `HOST` and `PORT`; the running container was checked to receive the password. Do not print expanded Compose configuration because it contains secrets. Never add admin, Redis or realtime secrets to Vercel or `VITE_` variables.

Only `pixelplaza` was rebuilt/recreated. Shared Redis volume `redis_redis_data` and unrelated service states were preserved. Production browser sign-in and authenticated management actions were not exercised.

## Start or stop the backend

After SSHing into the VM, start the existing container and check both endpoints:

```bash
docker start pixelplaza
curl -fsS https://pixelplaza-api.chrbuilds.dev/health
curl -fsS https://pixelplaza-api.chrbuilds.dev/api/lobbies
```

To stop only the PixelPlaza API again, run `docker stop pixelplaza`. This leaves Redis, realtime, and the other VM services running. Stopping the backend clears in-memory player positions; temporary chat remains in Redis until its 15-minute inactivity TTL expires.

Backend restarts clear the in-memory lobby and connected players must rejoin. Temporary chat remains in Redis until its 15-minute inactivity TTL expires. Do not remove shared Redis volumes or restart unrelated services during a backend update.

The VM is small and also runs n8n, Redis and shared realtime. The backend is limited to 96 MiB; the 10-player lobby limit is not a measured load guarantee. Sustained load has not been tested.

## Iframe deployment - 2026-10-15

After explicit approval, the VM checkout was fast-forwarded to application commit `6b4a0e4`, and only `POSTHOG_DASHBOARD_EMBED_URL` was securely added to the existing private `~/apps/pixelplaza/.env.production` (mode 600). All other runtime settings, installed Compose/env paths, networks and volumes were preserved. Only `pixelplaza` was rebuilt/recreated; unrelated running container IDs were unchanged. The URL/share token is not recorded here.

The API and Vercel `/api/admin/dashboard` endpoints returned 401 while signed out. Headless Edge signed into the live admin, loaded the real dashboard at 1440px and 390px widths, verified all 17 mobile chart headings fit within the reported 8289px iframe height, then signed out. The authenticated endpoint returned 200 with the validated embedded URL. These are emulated browser checks; the height is a verification snapshot.
