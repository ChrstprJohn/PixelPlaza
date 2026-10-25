# PixelPlaza

A planned pixel-art multiplayer plaza with **10 players per lobby**. React and Phaser render the game; a Node backend validates movement and chat; your Azure VM supplies isolated Redis storage and Centrifugo event delivery.

The local prototype is playable: landing page, guest name/character picker, walking, a 10-player lobby, temporary chat and six-second speech bubbles. The local Node backend validates guest sessions and movement; VM Redis holds expiring sessions, limits, chat and latest-state snapshots. Centrifugo delivers live updates.

## Local setup

Requires Node.js 22.12+ (Node 24 recommended) and npm. From the repository root:

Private realtime support is prepared and the VM-loopback listener is configured. Local development now needs an owner-opened SSH tunnel and `REALTIME_API_URL=http://127.0.0.1:4300`; follow [the tunnel workflow](documentation/LOCAL_DEVELOPMENT.md#ssh-tunnel-workflow) before running live service/lobby checks. Unit tests do not require the tunnel. Existing ignored local env files have not been modified by this change.

```powershell
npm install
npm test
npm run check:services
npm run dev:backend
```

In a second foreground terminal, run `npm run dev:frontend`, then open **http://localhost:5173**. Open multiple tabs to test guests together. Both servers bind to loopback, so other computers cannot join. Use WASD/arrows after clicking the map, or hold touch arrows on a small screen. Keyboard input does not move the character while typing chat.

With both servers running, `npm run check:lobby` checks the real Redis/realtime lobby, temporary chat expiry and the 10-player cap using disposable guests. Stop both terminals with Ctrl+C when finished.

Environment files live beside the app that uses them:

| App | Local values (Git-ignored) | Template | Loaded by |
| --- | --- | --- | --- |
| Frontend | `frontend/.env.local` | `frontend/.env.example` | Vite / `npm run dev:frontend` / `npm run build` |
| Backend | `backend/.env.local` | `backend/.env.example` | `npm run dev:backend`, `npm run check:services`, `npm run check:lobby` |

There is no root `.env.local` or `.env.example`. Both local files are configured on the original development PC. On another machine, copy each workspace's example to its local file and obtain PixelPlaza-specific backend credentials privately. Never reuse SchedSnap or starter Redis/realtime keys. Only the public API URL and PostHog ingestion settings belong in the frontend or Vercel. Leave `VITE_API_BASE_URL` empty to use the local backend proxy; setting it to the deployed API URL sends gameplay requests to that API.

Landing-page statistics are dynamic: total recorded production pageviews come from PostHog through the backend, active lobbies count open rooms, and active users sum current players. Lobby counts refresh every 15 seconds; visits refresh every minute using a five-minute backend cache. Unavailable values display an em dash. The visit query requires server-only `POSTHOG_PROJECT_ID`, `POSTHOG_PERSONAL_API_KEY` and `POSTHOG_API_HOST` settings; see the analytics guide.

Backend health: `http://127.0.0.1:3001/health`. Run servers in the foreground and stop with Ctrl+C. `check:services` verifies Redis isolation and live WebSocket delivery using disposable, expiring test data; it requires internet access and running VM services.

## Documentation

- [Implementation plan](documentation/PLAN.md)
- [Architecture and data flow](documentation/ARCHITECTURE.md)
- [Technology choices](documentation/TECH_STACK.md)
- [Local development and secrets](documentation/LOCAL_DEVELOPMENT.md)
- [PostHog analytics setup and dashboard](documentation/posthog/README.md)
- [Future deployment to the VM](documentation/VM_DEPLOYMENT.md)

The PixelPlaza backend is deployed at `~/apps/pixelplaza` and serves `https://pixelplaza-api.chrbuilds.dev`, including the real PostHog visit aggregate. See the deployment guide for current application commit and verification details. Chat keeps only the last 60 messages and expires after 15 minutes without a new message. A backend restart creates a fresh lobby; see [temporary storage rules](documentation/TEMPORARY_STORAGE.md).
