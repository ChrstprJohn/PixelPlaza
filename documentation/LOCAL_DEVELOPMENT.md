# Local development

## Earlier prototype checks and known limitation

Seven backend tests, the production frontend build, and the live VM lobby integration check pass. Desktop/mobile browser checks exercised joining, movement, chat and speech bubbles. The Windows Vite dev process nevertheless exited with native status `3221226505` after browser testing, including with Vite 7; the toolchain pin does not resolve that runtime issue. Restart the frontend when needed. Long-running dev-server stability and sustained multiplayer load remain unverified. Frontend visual polish is deferred at the user's request.

Run commands from the repository root with Node 22.12+ (24 recommended).

The VM-loopback listener is configured and verified as of 2026-10-25; the production PixelPlaza application cutover is still pending.
The owner opened the SSH tunnel and confirmed health OK. On 2026-10-25 both `npm run check:services` and `npm run check:lobby` passed, including token issuance through SSH, public WebSocket event delivery, chat/movement, Redis TTL, forged-session rejection and the 10-player cap. Local ignored backend env now uses `REALTIME_API_URL=http://127.0.0.1:4300`, and frontend `VITE_API_BASE_URL` is empty; credentials were preserved. The temporary test backend was stopped. Keep the tunnel open while developing; owner browser gameplay and production cutover remain pending. `npm test` uses
local test doubles and does not require a tunnel or VM credentials.

```powershell
npm install
npm test
npm run check:services
npm run dev:backend
```

Visit `http://127.0.0.1:3001/health`. In another foreground terminal, run `npm run dev:frontend` and open `http://localhost:5173`. Stop both with Ctrl+C before ending your session. The frontend implements the name/character picker, walking, chat and bubbles. Multiple local tabs can join together; other computers cannot access the loopback servers.

## Private environment

`backend/.env.local` contains generated PixelPlaza-specific backend credentials. Copy `backend/.env.example` there on a new machine and fill in private values. The root backend and service-check npm scripts explicitly load this file. Never commit it, copy it into browser code or paste its values into logs.

`frontend/.env.local` contains only public `VITE_` settings: `VITE_API_BASE_URL`, `VITE_POSTHOG_TOKEN` and `VITE_POSTHOG_HOST`. Vite loads it automatically from the frontend workspace. Copy `frontend/.env.example` there on a new machine. Leave the API base URL empty for the local proxy, or set the public deployed API origin to use that server. Vercel takes these same frontend variables from its build settings. Both examples contain placeholders for credentials; local files are Git-ignored. There are no env files at the repository root.

- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: your own VM gateway, using the familiar Upstash-compatible protocol. The Redis ACL restricts this token to `pixelplaza:*` and session/rate-limit commands.
- `REALTIME_API_URL=http://127.0.0.1:4300`, `REALTIME_API_KEY`: server-only project API access through the SSH tunnel. Docker production uses `http://realtime-server:3000`. These private URLs have no `/backend` suffix.
- `REALTIME_PROJECT_ID=pixelplaza`: project boundary; channels begin `pixelplaza/`.
- `REALTIME_WEBSOCKET_URL`: public URL; the frontend can know it.
- `FRONTEND_ORIGIN=http://localhost:5173`: exact app origin validation. For local development the backend also accepts its equivalent `127.0.0.1` origin.
- `LOBBY_PLAYER_LIMIT=10`: enforced lobby maximum; configurable between 1 and 10.
- `POSTHOG_PROJECT_ID`, `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_API_HOST`: server-only read access for the landing-page production pageview total. These belong in `backend/.env.local`, never the frontend. See [counting and cache rules](posthog/README.md#landing-page-statistics).
- `POSTHOG_DASHBOARD_EMBED_URL`: shared/embedded PixelPlaza dashboard URL, returned only to signed-in admins for the Analytics iframe. Backend only; see [the embedding guide](posthog/EMBED.md).

Registered Centrifugo browser origins: `http://localhost:5173` and `http://127.0.0.1:5173`. Backend requests still require project Bearer auth. Local development will reach the private realtime API through SSH; the deployed backend will reach it over `app_network`. Browsers continue to use the public `wss://realtime.chrbuilds.dev/connection/websocket` endpoint through Cloudflare. No realtime secret goes into a browser variable.

## SSH tunnel workflow

The VM now has loopback-only `127.0.0.1:4300` forwarded to the realtime API container's port 3000 in existing `~/realtime/server/docker-compose.yml` (project `server`). Its health/authentication and private Docker token/publish checks passed. `backend/realtime-tunnel.override.example.yaml` is a reference for new setups; do not apply it again to the configured service and duplicate the port. The laptop tunnel and local automated integration checks passed on 2026-10-25. Keep the tunnel open or reopen it for a later session. See [the deployment plan](VM_DEPLOYMENT.md#private-realtime-migration).

With the VM listener ready, the owner will run the following in a separate PowerShell window and leave it open:

```powershell
ssh -N -T -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o StrictHostKeyChecking=yes -i C:\Users\picar\Desktop\azure_vm\n8n-vm_key.pem -o UserKnownHostsFile=C:\Users\picar\Desktop\azure_vm\known_hosts -L 127.0.0.1:4300:127.0.0.1:4300 azureuser@74.176.65.214
```

This binds port 4300 only on the PC's loopback interface. A successful `-N` session normally stays quiet; keep it open while developing and press Ctrl+C to close it. `ExitOnForwardFailure` catches a local port bind failure; it does not prove the VM listener is running. The later service check verifies the complete path.

At that stage set only `REALTIME_API_URL=http://127.0.0.1:4300` in ignored `backend/.env.local`, preserving all existing secrets. Set `VITE_API_BASE_URL` empty in `frontend/.env.local` to use the local backend. Keep `REALTIME_WEBSOCKET_URL` at the public WSS address. Restart the local backend after changing its env file. Then run `npm run check:services`, followed by the local backend/frontend and `npm run check:lobby`. If the tunnel closes, realtime token/publish requests fail until it is reopened; never disable TLS verification to work around this.

Local lobby instances already generate random realtime channels and Redis session/chat prefixes, so local gameplay uses different instances from the deployed backend. This is not full environment isolation: the same project credentials share service quotas, and Redis `pixelplaza:admin:closed:*` settings are shared. Do not test admin lobby open/close actions with production Redis credentials. A fully isolated development project needs separate Redis/realtime credentials and application namespace support; that is not part of this transport fix.

On another PC, request/copy these credentials privately from the owner. They are not recoverable from Git. On the VM, private combined setup env is `~/realtime/credentials/pixelplaza.local.env`; realtime-only env is `~/realtime/credentials/pixelplaza.env`; Redis-only env is `~/redis/pixelplaza.redis.env`. Redis project files follow `PROJECT.redis.env`, matching `schedsnap.redis.env`. The combined local backend file is `backend/.env.local`. The deployed VM's runtime env remains at its existing location; reorganizing local files does not modify the VM.

## VM service management

SSH into the VM using your existing local key, then:

```bash
export PATH="$HOME/bin:$PATH"
realtimectl status
realtimectl start
realtimectl logs
redisctl status
```

Redis and realtime remain shared VM services. The PixelPlaza backend now runs on the VM at `https://pixelplaza-api.chrbuilds.dev`; this is separate from running the backend locally with `npm run dev:backend`. Restarting the Redis HTTPS gateway to load its token briefly affects other Redis REST clients; Redis data itself is preserved.

`npm run check:services` checks actual Redis read/write, blocked access to SchedSnap data/admin commands, token issuance, WebSocket connection, unauthorized subscription rejection, and event delivery. Its key expires in 60 seconds and is also deleted after the check. No lobby or chat history is created.

`npm run check:lobby` requires the backend running and uses disposable guests to verify movement, temporary Redis chat/TTL, event delivery, forged-session rejection and player 11 rejection. It leaves only a synthetic temporary chat message, which expires normally. It releases its own guests without disturbing other local players.

The frontend is pinned to Vite 7 after two Windows native-process exits with Vite 8; dependency recovery did not delete `node_modules` or use forced installs. Run plain `npm install` if switching machines.
