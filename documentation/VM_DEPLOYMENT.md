# VM deployment

## Current state

The backend is deployed and running in Docker on the Azure VM from `~/apps/pixelplaza`, application commit `0baafb1` on `main` (updated 2026-10-15). Caddy serves `https://pixelplaza-api.chrbuilds.dev`; its DNS A record points to `74.176.65.214`. `/health` returns 200 over HTTPS, and public `GET /api/lobbies` lists the available plazas. The bare `/` path returns JSON `Not found` by design because this hostname serves the API, not a web page.

The `pixelplaza` container is configured to join `app_network`, has no published host port, and has a 96 MiB memory limit. It uses the private `~/apps/pixelplaza/.env.production` file (mode 600). Its Redis/realtime credentials stay on the backend. The API allows the exact Vercel origin `https://pixelplaza-live.vercel.app`; both realtime origin allowlists include it too.

Local env files are now separated into `backend/.env.local` and `frontend/.env.local`, with matching workspace examples. The repository's Compose template now expects `backend/.env.production` for new deployments. The existing VM `compose.vm.yaml` and its root `.env.production` have not been changed. Before replacing that installed Compose file with the updated template, move its production env to `~/apps/pixelplaza/backend/.env.production` and preserve mode 600. Ordinary source-only updates can keep the installed Compose/env paths.

## Connect the Vercel frontend

In the Vercel project, set this Production environment variable, then redeploy:

```text
VITE_API_BASE_URL=https://pixelplaza-api.chrbuilds.dev
```

Never add admin, Redis or realtime secrets to Vercel frontend variables. Only public frontend settings belong there: `VITE_API_BASE_URL`, `VITE_POSTHOG_TOKEN` and `VITE_POSTHOG_HOST`. See [the PostHog guide](posthog/README.md) for the analytics values.

To enable the new landing-page visit total after deploying this source, add backend-only `POSTHOG_PROJECT_ID`, `POSTHOG_PERSONAL_API_KEY` (read-only `query:read`) and `POSTHOG_API_HOST` to the VM's private runtime env, then recreate only the PixelPlaza backend. Never place the personal key in Vercel or a `VITE_` variable. `/api/visits` returns the cached aggregate; active lobby/player totals use the existing `/api/lobbies` endpoint. These stats changes and private query settings have been verified locally but have not been deployed to the VM in this work.

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
