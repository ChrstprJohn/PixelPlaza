# PixelPlaza PostHog analytics

PixelPlaza uses the same public PostHog project as Celestial, SchedSnap and SignWise. Every event has `site_name = pixelplaza` and the Vite `environment` (`development` locally, `production` for a normal build). Filter both properties on every production insight.

## Configuration

Copy `frontend/.env.example` to `frontend/.env.local` and set:

```dotenv
VITE_POSTHOG_TOKEN=your_public_project_token
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

The original development machine's ignored `frontend/.env.local` is configured with the matching public token and host from the three reference apps. The public ingestion token is intended for the browser bundle; never use a personal API key in a `VITE_` variable or committed example. A separate read-only query key is configured only in `backend/.env.local` for the landing-page visit count.

Vite runs inside the `frontend` workspace and reads `frontend/.env.local`. Private backend settings live separately in `backend/.env.local`, loaded explicitly by backend npm scripts. No root env file is used. Restart Vite after changing local settings. For Vercel, add both variables to the frontend build environment and rebuild/redeploy. Local configuration does not change an existing deployment. A missing token disables tracking; rebuild with an empty token to disable a configured deployment.

## Implementation and privacy

`frontend/src/main.jsx` imports `analytics.js` before rendering React. It initializes `posthog-js` with automatic pageviews and masked click capture, following SignWise's configuration. PixelPlaza navigates between screens using React state, so `plaza_screen_viewed` separately records those transitions; internal screen changes are not additional `$pageview` events.

The SDK uses anonymous browser identifiers; the app never calls `identify`. Session recording, exception capture, performance capture and surveys are disabled. DOM text and attributes are masked. Admin pages skip initialization entirely, including sign-in and player lists. Custom events contain only the controlled metadata listed below. No names, chat text, guest/player IDs, session/realtime tokens, coordinates or movement streams are sent. Geography uses PostHog's approximate IP enrichment, with no browser location prompt.

This follows the reference SignWise setup: analytics starts when a token is configured, without an application consent banner. SDK capture opt-out is respected. Tracking failures must not interrupt joining or chatting.

| Event | Trigger | Custom properties |
| --- | --- | --- |
| `$pageview`, `$pageleave` | SDK browser page lifecycle | Standard SDK URL, referrer and device metadata |
| `$autocapture` | Masked DOM clicks | Masked SDK element metadata |
| `plaza_screen_viewed` | Landing, rooms, choose or lobby screen is shown | `screen`; `lobby_id` on choose/lobby |
| `lobby_join_started` | Guest submits the join form | `lobby_id`, `character` |
| `lobby_join_succeeded` | Join API succeeds and lobby opens | `lobby_id`, `character` |
| `lobby_join_failed` | Join fails | `lobby_id`, `character`, `error_type` (`network`, `http`, `unknown`), `http_status` (0 if unavailable) |
| `chat_opened` | Guest opens the chat panel | `lobby_id` |
| `chat_message_sent` | Chat API accepts a message | `lobby_id` |
| `lobby_left` | Guest uses Leave | `lobby_id` |

Every event also includes site/environment tags. `lobby_left` records the explicit exit even if the leave API is unavailable; closing a tab is not counted by that event. Joining is browser-observed API success, not proof that realtime connected. Chat events count accepted messages, not confirmed delivery to every guest. Anonymous visitors are browser identities, not verified people.

## Dashboard and verification

Use [the PixelPlaza dashboard prompt](DASHBOARD.md) in the shared project. The existing server-side query key returned HTTP 403 for dashboard listing, so a hosted PixelPlaza dashboard was not created by this change. No private query key is required for browser tracking. The admin Analytics tab links to the shared project; it does not embed a dashboard or claim events have been received.

## Landing-page statistics

All three statistics use real API data. **Total page visits** reads `GET /api/visits`: the backend runs a fixed all-time `count()` of `$pageview` events with `site_name = pixelplaza` and `environment = production`. It counts recorded page loads, including repeat visits, rather than unique people or in-page screen transitions. It does not reconstruct visits before tracking was enabled.

Configure these server-only values in `backend/.env.local` for development and the VM's private runtime env for production:

```dotenv
POSTHOG_PROJECT_ID=643035
POSTHOG_PERSONAL_API_KEY=your_read_only_personal_api_key
POSTHOG_API_HOST=https://us.posthog.com
```

Use a personal key with `query:read` access to the shared project. The existing SchedSnap query credentials for this same shared project were copied into the original machine's ignored backend env; no key was copied to the frontend or committed. EU projects use `https://eu.posthog.com` for this private query host. The public ingestion token cannot read reports. Frontend/Vercel variables remain the same three public settings.

The endpoint returns only `{ visits: number }`, accepts GET only, and exposes no client-supplied query. Concurrent reads share one request, successful totals are cached in backend memory for five minutes, and failures back off for 30 seconds. Missing credentials, upstream failures or invalid counts return HTTP 503 with `{ visits: null }`; zero is a valid total. Responses are `no-store`, so browsers do not cache a failed response. The frontend refreshes visits every minute while the landing page is visible.

**Active lobbies** counts rooms where `closed = false`, including full rooms. **Active users** sums current player counts across all rooms, including closed rooms with existing players. Both read the existing `GET /api/lobbies` response and refresh every 15 seconds while the landing page is visible. Returning to the tab refreshes both sources. Lobby names, chat and member details are not needed for these totals. An unavailable source displays an em dash independently of the other source; real zeros display 0. The stats component aborts requests and removes timers when leaving the landing page.

Local API requests follow `VITE_API_BASE_URL`; leave it empty to use the local backend proxy. The Vercel `/api/visits` rewrite also forwards same-origin requests to the backend. Production needs both the updated backend code and these private query variables deployed; pushing frontend code alone cannot add the new endpoint to the VM.

Production fix deployed on 2026-10-15 after explicit approval: the VM backend was updated to application commit `594d005` and its existing private production env now includes the three server-side query settings. The API and Vercel visit routes returned 200 with a total of 29 at verification time. The live landing page rendered that total instead of the unavailable em dash. The five-minute cache still applies; counts are not expected to increment instantly on each refresh.

Verification on 2026-10-15: all 23 tests and the production build passed. Backend tests cover fixed filters, caching/concurrent reads, failed queries/backoff, invalid configuration/counts, zero and HTTP method restrictions. Headless Edge verified all three displayed counts, independent API failures, empty rooms, malformed counts, 15-second lobby updates, minute visit updates and desktop/mobile layouts against mocked endpoints. A separate read-only live PostHog query succeeded and returned 0 recorded PixelPlaza production pageviews at verification time. No synthetic events were sent to the live project.

Run `npm test` for tagging, masking, opt-out, missing-token, blocked-SDK and admin-exclusion checks, plus the existing frontend/backend tests. Run `npm run build` to verify the configured production bundle. Tests use synthetic/mocked services, not live gameplay or production analytics delivery.

Verification on 2026-10-15: all 18 tests and the production build passed. Headless Edge exercised the built frontend against mocked game/ingestion services: pageview, masked clicks, screen navigation, failed join/retry/success, chat open/send and explicit exit were captured with both tags. Synthetic guest names, chat text, private error text and session/realtime tokens were absent from event payloads. Desktop/mobile admin screenshots were checked; admin navigation sent no analytics requests. The isolated browser test hid automation detection because the SDK deliberately filters automated browsers. No synthetic events were sent to live PostHog.

After deployment, open the public site, choose a lobby, join and send a test message. In PostHog live events, filter `site_name = pixelplaza` and `environment = production`; confirm `$pageview`, `plaza_screen_viewed`, `lobby_join_succeeded` and `chat_message_sent`. Inspect payloads for absent names, message contents and credentials. Admin navigation should add no events. Allow ingestion processing time and account for browser blockers.

Reference: [PostHog JavaScript configuration](https://posthog.com/docs/libraries/js/config).

Query authentication reference: [PostHog API overview](https://posthog.com/docs/api).
