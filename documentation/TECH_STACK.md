# Tech stack

| Part | Choice | Why |
|---|---|---|
| Frontend shell | React 19.3.0 | Landing, join UI and game lifecycle |
| Game renderer | Phaser 4.2.1 | Pixel-art scene, animation and input |
| Browser realtime client | centrifuge 5.7.4 | Centrifugo connection, token refresh and reconnect |
| Frontend tooling | Vite 8.3.4 + React plugin 6.1.2 | Future local frontend and static production build |
| Backend | Node.js 22.12+; Node 24 recommended | Authoritative guest lobby, native HTTP/fetch/crypto |
| Tests | Node built-in test runner | Small setup/security tests without extra tooling |
| Temporary shared storage | Existing Docker Redis through HTTPS gateway | Expiring sessions and atomic limits |
| Live delivery | Existing Centrifugo + project-key gateway | Reuse the secured VM infrastructure |
| Proxy and TLS | Existing Caddy | Public HTTPS/WSS, private Docker ports |
| Frontend hosting | Vercel, later | Static React/Phaser assets |
| Backend hosting | Azure VM Docker, later | One process owns the lobby state |

The backend starter uses Node's standard library rather than adding a framework just for health/setup. Dependencies are pinned and the lockfile is committed. No Socket.IO, permanent database or authentication provider is introduced for the initial guest version.

References: [Phaser installation](https://docs.phaser.io/phaser/getting-started/installation), [Vite requirements](https://vite.dev/guide/), [Centrifugo server subscriptions](https://centrifugal.dev/docs/server/server_subs).
