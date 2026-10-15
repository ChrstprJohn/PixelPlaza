# PixelPlaza admin

Open `/admin` on the frontend. It uses the existing cream, green, Nunito and Pixelify Sans styling, with a simple sign-in form and Lobbies / Analytics navigation.

## Sign in

Set `ADMIN_PASSWORD` in the **backend** environment to a unique 16–256 character password. An optional `ADMIN_SESSION_SECRET` (at least 32 characters) supplies a separate signing key; otherwise the backend derives one from the password. Changing the password invalidates existing sessions. Restart the backend after changing environment variables.

Local development uses the ignored root `.env.local`. A random local admin password has been added there for preview. Never place this password or the session secret in a `VITE_` variable or commit them.

Sign-in creates an eight-hour signed HttpOnly, SameSite=Strict cookie. Production cookies require HTTPS. Password guesses are limited to ten attempts per minute across the backend process; all admin writes require an allowed website Origin and JSON. Admin routes use same-origin `/api/admin` requests; Vite proxies them locally, and `vercel.json` forwards them to the production API. This avoids depending on third-party cookies between Vercel and the API domain.

## Lobby controls

- View live player counts and names, refreshed every five seconds while the page is visible.
- Close a lobby to new players, or reopen it. Existing players can remain inside a closed lobby.
- Remove a player after inline confirmation. Their session ends; removal is not a permanent ban, so they can join again.

Open/closed settings persist in Redis under `pixelplaza:admin:closed:<lobbyId>`. No chat contents, guest tokens or API credentials are returned in admin lists. Player positions and sessions retain their existing restart behavior.

Analytics is an explicitly unconnected PostHog placeholder. No fake analytics or tracking SDK is included. Current player counts are available under Lobbies.

## Deployment

These changes are local until committed and deployed. Deploy both the backend and frontend, set `ADMIN_PASSWORD` in the VM backend environment, and ensure the exact frontend origin is in `FRONTEND_ORIGIN`. No VM changes were made during local implementation.

## Verification

`npm test` covers unauthorized access, allowed origins, incorrect passwords, signed cookie attributes, expiry/tampering, throttling, persisted lobby closures and removal of guest sessions. `npm run build` checks frontend compilation. Admin UI follows the existing visual theme; its compact room rows stack controls on small screens.

Browser checks confirmed sign-in, narrow/desktop layouts, close/reopen, player-list refresh, inline removal confirmation and the analytics placeholder. Both lobbies were left open and the disposable preview guest was removed.
