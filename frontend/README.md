# Frontend workspace

The local React/Phaser frontend implements the landing page, nickname/character selection, walkable pixel plaza, chat panel and character speech bubbles. Run `npm run dev:frontend` from the repository root alongside the backend, then visit http://localhost:5173. Vercel deployment is deferred.

The browser will call the PixelPlaza backend, receive a short-lived connection JWT, and connect to the VM's Centrifugo. API keys remain backend-only. See [the plan](../documentation/PLAN.md) and [architecture](../documentation/ARCHITECTURE.md).
