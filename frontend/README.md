# PixelPlaza frontend

React/Vite frontend for the landing page, avatar picker, and multiplayer plaza.

## Local development

From the repository root, run `npm run dev:frontend` and `npm run dev:backend`. Vite proxies `/api` requests to `http://127.0.0.1:3001` when `VITE_API_BASE_URL` is unset.

## Vercel

Create a Vercel project for `ChrstprJohn/PixelPlaza` and set **Root Directory** to the repository root. The root `vercel.json` selects Vite, runs `npm run build`, and serves `frontend/dist`. The root `package-lock.json` lets Vercel install the npm workspaces. The repository requires Node.js 22.12 or newer; choose Node.js 22.x in the Vercel project settings.

Set `VITE_API_BASE_URL` in Vercel to the public HTTPS origin of the separately hosted backend, such as `https://api.example.com`, with no `/api` suffix. Set it for each environment you plan to use, then redeploy. This variable is included in the browser bundle, so it must contain only the public backend URL. Do not put Redis or realtime API keys in Vercel frontend variables.

The backend must allow the deployed site's exact origin in `FRONTEND_ORIGIN`, for example `https://pixelplaza.vercel.app`. Add any preview origin you want to test as another comma-separated value. The browser also needs access to the public realtime WebSocket endpoint configured on the backend.

Vercel serves the frontend only. The lobby will work after the backend is hosted on a public HTTPS endpoint and `VITE_API_BASE_URL` and `FRONTEND_ORIGIN` are set. Landing and avatar selection can be checked before then.

This app uses in-page state instead of URL routes, so it does not need an SPA fallback rewrite. See [the plan](../documentation/PLAN.md) and [architecture](../documentation/ARCHITECTURE.md).
