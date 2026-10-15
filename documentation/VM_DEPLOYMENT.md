# VM deployment

## Current state

The backend is deployed and running in Docker on the Azure VM from `~/apps/pixelplaza`, application commit `9cf7b3e`. Caddy serves `https://pixelplaza-api.chrbuilds.dev`; its DNS A record points to `74.176.65.214`. `/health` returns 200 over HTTPS, and public `GET /api/lobbies` lists the available plazas. The bare `/` path returns JSON `Not found` by design because this hostname serves the API, not a web page.

The `pixelplaza` container is configured to join `app_network`, has no published host port, and has a 96 MiB memory limit. It uses the private `~/apps/pixelplaza/.env.production` file (mode 600). Its Redis/realtime credentials stay on the backend. The API allows the exact Vercel origin `https://pixelplaza-live.vercel.app`; both realtime origin allowlists include it too.

## Connect the Vercel frontend

In the Vercel project, set this Production environment variable, then redeploy:

```text
VITE_API_BASE_URL=https://pixelplaza-api.chrbuilds.dev
```

Never add Redis or realtime API keys to Vercel frontend variables. Only the public API URL belongs in the browser build.

## Update the VM backend

The VM repository uses HTTPS. To pull a later GitHub change and rebuild/restart the backend:

```bash
cd ~/apps/pixelplaza
git pull --ff-only
docker compose -f compose.vm.yaml up -d --build
docker compose -f compose.vm.yaml ps
```

Check health with:

```bash
curl -fsS https://pixelplaza-api.chrbuilds.dev/health
```

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
