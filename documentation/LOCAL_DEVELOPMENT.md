# Local development

Run commands from the repository root with Node 22.12+ (24 recommended).

```powershell
npm install
npm test
npm run check:services
npm run dev:backend
```

Visit `http://127.0.0.1:3001/health`. Stop with Ctrl+C before ending your session. The frontend workspace currently prepares dependencies only; its playable scene and dev entry are the next phase.

## Private environment

`.env.local` contains generated PixelPlaza-specific credentials. `.env.example` has placeholders only and is safe to commit. Never commit `.env.local`, copy it into browser code or paste its values into logs.

- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: your own VM gateway, using the familiar Upstash-compatible protocol. The Redis ACL restricts this token to `pixelplaza:*` and session/rate-limit commands.
- `REALTIME_API_URL`, `REALTIME_API_KEY`: server-only project API access.
- `REALTIME_PROJECT_ID=pixelplaza`: project boundary; channels begin `pixelplaza/`.
- `REALTIME_WEBSOCKET_URL`: public URL; the frontend can know it.
- `FRONTEND_ORIGIN=http://localhost:5173`: future app origin validation. Health-only starter has no mutation routes yet.
- `LOBBY_PLAYER_LIMIT=10`: planned lobby maximum; it takes effect when lobby logic is implemented.

Registered Centrifugo browser origins: `http://localhost:5173` and `http://127.0.0.1:5173`. Backend requests use project Bearer auth over the internet; they are not limited to Docker's internal network.

On another PC, request/copy these credentials privately from the owner. They are not recoverable from Git. On the VM, private combined setup env is `~/realtime/credentials/pixelplaza.local.env`; realtime-only env is `~/realtime/credentials/pixelplaza.env`; Redis-only env is `~/redis/pixelplaza.redis.env`. Redis project files follow `PROJECT.redis.env`, matching `schedsnap.redis.env`. The combined local backend file remains `.env.local`.

## VM service management

SSH into the VM using your existing local key, then:

```bash
export PATH="$HOME/bin:$PATH"
realtimectl status
realtimectl start
realtimectl logs
redisctl status
```

Redis and realtime are intended to stay running for local integration now. This does not deploy the PixelPlaza backend. Restarting the Redis HTTPS gateway to load its new token briefly affects other Redis REST clients; Redis data itself is preserved.

`npm run check:services` checks actual Redis read/write, blocked access to SchedSnap data/admin commands, token issuance, WebSocket connection, unauthorized subscription rejection, and event delivery. Its key expires in 60 seconds and is also deleted after the check. No lobby or chat history is created.
