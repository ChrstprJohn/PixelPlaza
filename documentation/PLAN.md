# Plan

## Agreed first version

- One lobby, maximum 10 connected players. Reject an 11th player cleanly.
- Guests choose a nickname and avatar; no account requirement.
- Players move around a shared pixel-art plaza and send short chat messages.
- Positions, facing direction and avatars live in Node memory. Each accepted update replaces the current state; no movement history is stored.
- Redis stores expiring guest sessions and atomic chat/join rate-limit counters under `pixelplaza:*`.
- Centrifugo delivers batched movement snapshots, chat and join/leave events.
- Chat history is temporary in Redis: latest 60 messages, expiring after 15 minutes without a new message. Disconnects expire after a 45-second heartbeat/input timeout.
- Restarting the backend resets the lobby. Persisted Redis session records do not restore player positions; the client must rejoin.

## Initial setup delivered

Repository/workspaces, pinned frontend dependencies and npm lockfile; local Node health endpoint; Redis/realtime backend helpers; service verification and unit tests; isolated VM project registrations; ignored local credentials; future Docker/Compose templates; this documentation.

Implemented now: landing page, predefined four-character picker, guest join, 10-player membership, authoritative bounded movement, live snapshots, chat and six-second bubbles, heartbeat, token refresh and leave. Redis backs temporary sessions, limits, chat and latest-state snapshots. See [storage details](TEMPORARY_STORAGE.md).

## Implementation status and next steps

The local implementation covers steps 1-5 and the 10-player/expiry/security checks from step 6. Browser checks cover joining, touch movement, cross-guest chat, speech bubbles and desktop/mobile layout. Broader load/long-duration testing and deployment remain future work; this is a local prototype.

1. Build the React landing/join screen and Phaser map, avatar rendering, keyboard movement and lifecycle cleanup.
2. Implement guest join, bounded in-memory lobby membership, Redis-backed session expiry and an atomic rate-limit reservation. Bind lobby membership to a verified guest session; never trust a client-provided player ID.
3. Implement authenticated movement, chat, heartbeat, leave and realtime-token endpoints. Enforce map bounds, allowed avatars, speed checks, message lengths, session validity and origin restrictions.
4. Simulate locally at up to 10 inputs/player/second; broadcast one whole-lobby snapshot at **5 Hz**. Interpolate remote avatars on the frontend. Keep movement inputs separate from broadcast frequency.
5. Publish join/leave/chat events through the same project-scoped gateway. Refresh connection JWTs and re-fetch an authoritative snapshot after reconnection.
6. Test 10 browser clients, reject player 11, exercise chat flooding, forged identities, disconnects and backend restarts. Measure delivery latency, VM memory and CPU before changing limits.
7. Deploy the frontend to Vercel and register its exact origin. After local validation, pull the repository to `~/apps/pixelplaza`, configure its own Docker service and Caddy route.

## Resource budget

The gateway allows 600 publishes/minute per project. A 5 Hz whole-lobby snapshot uses 300/minute, leaving 300 for chat and membership events. Enforce an aggregate event budget and backoff on 429; do not publish each player's movement separately. Ten players sending 10 inputs/second is 100 backend input requests/second, not 100 gateway publishes/second. Verify this on the real workload; the 10-player target is not a measured capacity guarantee.

The implemented chat limit is 5 messages/player/10 seconds, alongside a 540-publish/minute local budget. Sessions expire after 30 minutes, inactive players leave after 45 seconds, and movement uses server-owned map geometry. See the storage guide for exact lifecycle rules.

## Later, only when needed

Multiple lobbies, moderation and accounts. Mobile touch movement is already included. Use PostgreSQL for permanent avatars, inventory or account-owned content; do not store every movement update. No PostgreSQL or MongoDB is required for the initial guest lobby.
