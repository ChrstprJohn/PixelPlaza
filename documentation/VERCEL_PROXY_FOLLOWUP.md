# Vercel admin/visits proxy observation

An automated request check on 2026-10-25 received Cloudflare `403` challenge responses (`cf-mitigated: challenge`) for `/api/admin/session` and `/api/visits` through the Vercel hostname. Direct requests to the PixelPlaza API host returned `200`, and the deployed frontend bundle had `VITE_API_BASE_URL=https://pixelplaza-api.chrbuilds.dev`. Production realtime WebSocket and gameplay checks passed.

The owner reports normal browser features are working. The automated `403` observations do not prove that real browser admin sign-in or visit counting is broken, so keep this item as a diagnostic note rather than a confirmed user-facing outage. No Vercel environment, rewrite, DNS, or Cloudflare security settings were changed for this observation or for the local admin UI refresh.

If the issue returns, compare the actual browser flow with direct requests and record which route and operation fails before changing routing. Docker and SSH-tunnel URLs and private credentials never belong in `VITE_` variables. Any future proxy change should preserve same-origin admin cookie/auth behavior. Do not broadly disable Cloudflare protections or add DNS-only/broad-IP exceptions as an incidental change.

No unresolved Vercel change is required for the private realtime setup. Revisit this note only if the owner can reproduce a browser-facing problem or current browser checks establish one.
