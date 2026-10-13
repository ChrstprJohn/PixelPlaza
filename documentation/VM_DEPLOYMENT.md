# Future VM deployment

Do this **after the playable backend has been implemented and tested locally**. This initial setup does not deploy PixelPlaza or expose its game API.

## Intended layout

```text
~/apps/pixelplaza/                 Git checkout; backend runs here in Docker
~/realtime/server/                Shared project-authenticated gateway
~/realtime/centrifugo/            Shared realtime delivery
~/redis/                         Shared Redis/gateway, separate project credentials
~/infrastructure/caddy/Caddyfile  HTTPS routing
```

The frontend is built/deployed to Vercel. The VM hosts a single PixelPlaza backend process to own the 10-player lobby. Its container joins existing `app_network`, with no public port mapping.

## Deployment steps later

1. Implement and verify game routes, authentication, origin checks, bounded memory, movement validation and rate limits. Verify 10-player operation and reject player 11.
2. Deploy the frontend and obtain its final origin. Add that exact origin to PixelPlaza's entry in `~/realtime/server/config/projects.json` and to Centrifugo's `client.allowed_origins`, then stop/start realtime to reload them. The existing registration command refuses to overwrite an existing project; do not regenerate keys accidentally.
3. Create a DNS A record such as `pixelplaza-api.chrbuilds.dev → 74.176.65.214`.
4. Clone the repository using the VM's existing GitHub authentication:

```bash
mkdir -p ~/apps
cd ~/apps
git clone https://github.com/ChrstprJohn/PixelPlaza.git pixelplaza
cd pixelplaza
cp backend/compose.vm.example.yaml compose.vm.yaml
```

5. Create `.env.production` privately with PixelPlaza's Redis/realtime credentials, the production `FRONTEND_ORIGIN`, and `LOBBY_PLAYER_LIMIT=10`. Keep `REALTIME_PROJECT_ID=pixelplaza`. Compose sets `HOST=0.0.0.0` inside the container and `PORT=3001`. Never commit production env files.
6. Start the backend from the repository root:

```bash
docker compose -f compose.vm.yaml up -d --build
docker compose -f compose.vm.yaml ps
docker compose -f compose.vm.yaml logs --tail 50
```

7. Add this Caddy route, validate it and reload Caddy:

```caddyfile
pixelplaza-api.chrbuilds.dev {
    reverse_proxy pixelplaza:3001
}
```

```bash
docker exec caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

8. Set the frontend's public PixelPlaza backend URL and rebuild/redeploy it. Never set the Redis or realtime project API keys as frontend variables. Verify health, origin rules, join, token refresh, movement, chat, disconnect/reconnect and shared service resource usage.

## Update and rollback

```bash
cd ~/apps/pixelplaza
git pull --ff-only
docker compose -f compose.vm.yaml up -d --build
```

Pin/review dependency changes. Keep the previous Git commit/image for rollback. A backend restart empties the in-memory lobby; clients must rejoin. Do not delete Redis volumes or restart unrelated database/auth services as deployment cleanup.

The starter Docker template limits backend memory to 96 MiB; adjust only from measurements. The VM has about 1 GiB RAM and also runs Caddy, n8n, Redis/gateway and realtime. No throughput or player-capacity guarantee, HA or off-VM backup is configured. Growing beyond one process needs explicit shared lobby ownership, not simply another replica.
