# Frontend workspace

React, Phaser, the Centrifugo browser SDK and Vite dependencies are prepared. The landing page, renderer and multiplayer UI are the next implementation phase; there is no playable frontend or Vercel deployment in this initial setup.

The browser will call the PixelPlaza backend, receive a short-lived connection JWT, and connect to the VM's Centrifugo. API keys remain backend-only. See [the plan](../documentation/PLAN.md) and [architecture](../documentation/ARCHITECTURE.md).
