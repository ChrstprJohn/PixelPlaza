# Local development

## Verified prototype and known limitation

Seven backend tests, the production frontend build, and the live VM lobby integration check pass. Desktop/mobile browser checks exercised joining, movement, chat and speech bubbles. The Windows Vite dev process nevertheless exited with native status `3221226505` after browser testing, including with Vite 7; the toolchain pin does not resolve that runtime issue. Restart the frontend when needed. Long-running dev-server stability and sustained multiplayer load remain unverified. Frontend visual polish is deferred at the user's request.

Run commands from the repository root with Node 22.12+ (24 recommended).

```powershell
npm install
npm test
npm run check:services
npm run dev:backend
```

Visit `http://127.0.0.1:3001/health`. In another foreground terminal, run `npm run dev:frontend` and open `http://localhost:5173`. Stop both with Ctrl+C before ending your session. The frontend implements the name/character picker, walking, chat and bubbles. Multiple local tabs can join together; other computers cannot access the loopback servers.

## Private environment

`.env.local` contains generated PixelPlaza-specific credentials. `.env.example` has placeholders only and is safe to commit. Never commit `.env.local`, copy it into browser code or paste its values into logs.

- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: your own VM gateway, using the familiar Upstash-compatible protocol. The Redis ACL restricts this token to `pixelplaza:*` and session/rate-limit commands.
- `REALTIME_API_URL`, `REALTIME_API_KEY`: server-only project API access.
- `REALTIME_PROJECT_ID=pixelplaza`: project boundary; channels begin `pixelplaza/`.
- `REALTIME_WEBSOCKET_URL`: public URL; the frontend can know it.
- `FRONTEND_ORIGIN=http://localhost:5173`: exact app origin validation. For local development the backend also accepts its equivalent `127.0.0.1` origin.
- `LOBBY_PLAYER_LIMIT=10`: enforced lobby maximum; configurable between 1 and 10.

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

`npm run check:lobby` requires the backend running and uses disposable guests to verify movement, temporary Redis chat/TTL, event delivery, forged-session rejection and player 11 rejection. It leaves only a synthetic temporary chat message, which expires normally. It releases its own guests without disturbing other local players.

The frontend is pinned to Vite 7 after two Windows native-process exits with Vite 8; dependency recovery did not delete `node_modules` or use forced installs. Run plain `npm install` if switching machines.
