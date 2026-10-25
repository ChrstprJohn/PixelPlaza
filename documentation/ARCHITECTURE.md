# Architecture

## During local development

```text
Browser on localhost:5173 (React + Phaser)
  → local PixelPlaza backend on 127.0.0.1:3001
      → VM Redis HTTPS: expiring sessions and rate counters
      → local SSH tunnel → private VM realtime API: tokens and event publishing
  → Cloudflare → VM Centrifugo WebSocket: receives authorized lobby updates
```

The browser never calls Redis or receives private project API keys. The local backend uses the ignored `backend/.env.local`; Vite reads only public `VITE_` settings from `frontend/.env.local`. VM Redis and realtime are shared with other projects but PixelPlaza has its own credentials, key patterns and channel prefix.

Private realtime transport is deployed. Production calls `http://realtime-server:3000` on `app_network`; local development uses `http://127.0.0.1:4300` through the owner-opened tunnel. Caddy's public realtime `/backend` route is removed. The browser WebSocket stays public and Cloudflare-proxied. Local automated/browser checks and production token/guest/WSS delivery checks passed. Realtime API auth still applies, with only a VM-loopback API port for SSH. The separate Vercel same-origin admin/visits rewrite issue is recorded in [the proxy follow-up](VERCEL_PROXY_FOLLOWUP.md).

## Implemented player flow

1. Browser submits nickname/avatar to the local backend. Backend validates them, checks lobby capacity and creates a guest identity/session.
2. Backend returns current lobby state and a short-lived JWT after approving access to `pixelplaza/lobby/main`. Guest credentials must be unguessable and supplied on subsequent backend requests; choose the cookie/token mechanism during implementation.
3. Browser connects to `wss://realtime.chrbuilds.dev/connection/websocket`. Its signed JWT assigns the approved subscription; it cannot subscribe to another project's channel or publish directly.
4. Browser sends movement inputs to PixelPlaza's backend. Backend validates identity, speed and bounds, updates its current memory state, and broadcasts a batched snapshot at 5 Hz.
5. Backend validates/rate-limits chat before publishing it. Incoming messages are treated as text, never executable HTML.
6. Heartbeats update liveness. On leave/timeout the backend releases the player slot and announces the change. Reconnects re-fetch current state instead of assuming every live event was received.

## Storage boundaries

| Data | Storage | Lifetime |
|---|---|---|
| Current player positions, avatar, facing, membership | Node memory | Until leave/timeout/backend restart |
| Guest session validation | Redis `pixelplaza:session:*` | Bounded automatic TTL |
| Join/chat rate counters | Redis `pixelplaza:rate:*` | Short automatic TTL |
| Recent chat | Redis `pixelplaza:lobby:INSTANCE:chat` | Latest 60 messages; 15-minute inactivity TTL |
| Latest lobby snapshot | One overwritten Redis `pixelplaza:lobby:INSTANCE:state` key | 60-second TTL |
| Movement/chat broadcasts | Centrifugo | Live delivery only |
| Accounts/inventory/saved content | Not implemented | Future PostgreSQL |

Redis has a shared 128 MiB data limit, no eviction and AOF disk persistence. Expiring keys keep temporary records bounded; they do not make capacity unlimited. A Redis write failure must fail closed for protected actions. PixelPlaza cannot read `schedsnap:*` or run Redis administrative commands.

Centrifugo uses its memory engine; the application Redis is not its broker. History/presence are disabled. The global connection cap is configured at 500 and 5 per scoped user, not a proven game capacity. PixelPlaza adds its own 10-player cap.
