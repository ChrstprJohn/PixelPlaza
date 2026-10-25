# Vercel admin/visits proxy follow-up

Identified 2026-10-25 after successful private realtime deployment. Public direct PixelPlaza API health/lobbies/visits return 200 and the deployed frontend bundle has the correct `VITE_API_BASE_URL=https://pixelplaza-api.chrbuilds.dev`. Public realtime WebSocket and production gameplay checks pass.

However, existing `vercel.json` external rewrites for `/api/admin/:path*` and `/api/visits` send Vercel server requests through Cloudflare. `/api/admin/session` and `/api/visits` through the Vercel hostname return 403 with `cf-mitigated: challenge`. The admin UI uses same-origin requests and may be unavailable even though gameplay works. This route failure was reported by the verification check; it is not counted as a passing admin browser test.

No Vercel env update is needed for the realtime change itself. Docker/tunnel URLs and private credentials never belong in `VITE_` variables. Resolve this separately with a deliberate authenticated server-to-origin proxy route or a supported scoped bot policy, preserving same-origin admin cookie/auth behavior. Free Bot Fight Mode cannot be skipped with a custom WAF rule; do not broadly disable protection or add DNS-only/broad-IP exceptions as an incidental edit.

Verify signed-out session behavior, authenticated sign-in/dashboard/sign-out, unauthorized admin denial and visits through Vercel before marking this issue fixed. DNS, proxy-function or paid-plan decisions are not silently part of the completed VM realtime cutover.
