# Temporary storage and lifecycle

## Positions

Node owns the current position, direction, input and lobby membership. Clients send direction inputs, never trusted coordinates. The server advances at 20 Hz, normalizes diagonals and applies bounds/obstacles. Inputs stop after 300 ms without renewal. Movement snapshots publish at most 5 Hz.

While state is changing, the latest full snapshot overwrites one Redis key roughly once per second with a 60-second TTL. There is no list of movement records. Expired snapshots are not restored after a backend restart.

## Guest sessions

An unguessable 256-bit bearer guest token is returned to the browser. Only its hash is used in the Redis key; Redis stores the associated player ID. Session TTL is 30 minutes, renewed by ten-second heartbeats. Membership is also kept in Node memory, so a Redis record alone cannot join a restarted backend. Movement uses short cached verification, refreshed against Redis; protected chat/token/heartbeat actions verify storage directly.

Leave removes the session. No input/heartbeat for 45 seconds removes the player. Regular server shutdown deletes its guest session keys. On a crash, TTL is the cleanup fallback. New server starts use a new instance-scoped channel/key prefix to prevent ghost players.

## Chat

Chat messages are plain text, 1-200 characters, with nickname/character, guest ID, timestamp and random message ID. An atomic Redis Lua script pushes the message, trims the list to 60 and sets a 900-second TTL. Each new message renews the **whole list** TTL; it is 15 minutes of inactivity, not individual per-message expiry.

At most 5 messages per guest per 10 seconds are allowed via an expiring atomic Redis counter. The combined snapshot/chat publish budget is 540/minute, leaving margin below the shared gateway's 600/minute per-project limit. If notification publishing fails after a message is stored, it remains available through the authenticated state/history endpoint; clients resync every ten seconds.

New guests read the recent temporary history. The frontend replaces expired history during resync instead of keeping it indefinitely. A message also shows above the speaking character for six seconds. React renders chat as text, not HTML. No permanent chat table is configured.

Graceful shutdown removes sessions/state but leaves temporary chat to expire. New backend instances do not read the old instance's chat. Redis AOF can persist active temporary records to disk; TTL controls live-key lifetime, not every byte in old persistence/backups. Never describe temporary chat as guaranteed never written to disk.

## API and boundaries

`POST /api/join`, `/api/move`, `/api/chat`, `/api/heartbeat`, `/api/token`, `/api/leave`; authenticated `GET /api/lobby`; public `GET /health`. Mutations require JSON, body limit 4 KiB, exact allowed browser origins and valid guest sessions except join. Anonymous joins are limited to 20 per IP/minute with hashed keys. No client-supplied guest IDs or coordinates are trusted.

Project Redis/API keys stay in ignored backend env files; browsers receive only short-lived connection JWTs and guest tokens. Centrifugo JWTs last 15 minutes; removal from the lobby prevents backend actions but an already issued JWT is not instantly revoked cryptographically. This is a casual local guest lobby, not a production moderation/security guarantee.

Tests cover capacity, forged sessions, invalid names/avatars, speed/diagonal input, rate limits, 60-message trimming, idle chat expiry, heartbeat renewal, storage failure, backend restarts, origin checks, malformed/oversized requests and real VM delivery. Production hosting, HA, load testing and account moderation remain future work.
