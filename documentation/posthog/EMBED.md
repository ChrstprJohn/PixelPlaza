# Embed the PixelPlaza PostHog dashboard

This follows SchedSnap's setup: the backend stores the dashboard link, an authenticated admin endpoint returns it, and the Analytics tab displays an iframe. No extra PostHog API key or frontend variable is needed.

## Get or replace the link

1. Open your **PixelPlaza** dashboard in the shared PostHog project. Verify `site_name = pixelplaza` and `environment = production` on the dashboard and its insights.
2. Click **Share** at the top right, enable public sharing, then copy the shared link or the `src` value from the iframe embed code. Do not copy the whole `<iframe>` tag or the normal `/project/.../dashboard/...` address.
3. Set the link in ignored `backend/.env.local`:

   ```dotenv
   POSTHOG_DASHBOARD_EMBED_URL=https://us.posthog.com/shared/YOUR_SHARE_TOKEN
   ```

   Both `/shared/` and `/embedded/` links work; the backend converts shared links to embedded links. The owner's provided PixelPlaza URL is configured locally and in the VM's private production env. Keep the real share token out of committed examples.

4. Restart the backend with `npm run dev:backend`, or update the existing VM runtime file `~/apps/pixelplaza/.env.production` and recreate only the PixelPlaza container for production. The current installed Compose file loads that root production env file; do not change its path just to set this variable. Frontend and backend code must both include the embed feature.
5. Sign in at `/admin`, then select **Analytics**. The dashboard should render inside PixelPlaza. Use **Open dashboard in new tab** if an extension or browser restriction blocks framing.

`POSTHOG_DASHBOARD_EMBED_URL` belongs only in the backend env, with no `VITE_` prefix. Vercel's frontend still needs only `VITE_API_BASE_URL`, `VITE_POSTHOG_TOKEN` and `VITE_POSTHOG_HOST`. The existing `/api/admin/:path*` rewrite covers the new endpoint.

## Behavior

- `GET /api/admin/dashboard` requires the existing admin session cookie and uses `Cache-Control: no-store`. Signed-out requests receive 401 without disclosing the link.
- Only HTTPS PostHog shared/embedded URLs are accepted. URLs with credentials, nonstandard ports, unrelated hosts or normal project-dashboard paths are rejected.
- An empty setting shows a connection message; an invalid setting or failed request shows an error and **Retry analytics**.
- The iframe fills the available admin width on desktop, with 4px outer margins on phones to give charts more room. It starts at 900px high and follows PostHog's `posthog:dimensions` messages. Only messages from the expected PostHog origin and that exact iframe, named `PixelPlazaAnalytics`, can resize it. Heights must be positive and less than 100,000px. Like SchedSnap, the iframe disables internal scrollbars and the admin page scrolls through its reported height. If browser restrictions prevent sizing or rendering, use the new-tab link.
- Admin pages still do not initialize PixelPlaza's tracking SDK. Loading the third-party PostHog embed is separate from recording PixelPlaza guest events.

The admin login limits where the app reveals the URL. Public sharing still lets anyone holding that link view the dashboard directly; revoke sharing in PostHog to revoke the link. Keep this dashboard filtered to PixelPlaza before sharing it.

## Verification

On 2026-10-15, all 24 tests and the production build passed. Backend checks cover sign-in protection, absent settings, shared-link conversion, supported PostHog hosts and rejection of unrelated/insecure/credential-bearing URLs. Headless Edge loaded the actual owner-supplied dashboard inside the built local admin app at 1440px desktop and 390px phone widths. It verified chart headings fit the mobile viewport, the outer page does not scroll sideways, and PostHog's height messages resize the frame. Mocked states verified missing/invalid settings, retry, and rejection of messages with the wrong origin, source, frame name or invalid height. PostHog retains a small internal document gutter; PixelPlaza uses the same no-internal-scrollbar approach as SchedSnap. These are emulated browser checks, not physical-phone testing.

Live deployment on 2026-10-15: application commit `6b4a0e4` and the backend dashboard setting were deployed after approval. Signed-in desktop/mobile checks passed against the real dashboard; all 17 mobile chart headings fit within the 8289px iframe height at verification time. Signing out restored HTTP 401 for the dashboard endpoint.

Reference: [PostHog dashboard sharing and embedding](https://posthog.com/docs/product-analytics/dashboards#sharing-a-dashboard).
