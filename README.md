# PixelPlaza

A planned pixel-art multiplayer plaza with **10 players per lobby**. React and Phaser render the game; a Node backend validates movement and chat; your Azure VM supplies isolated Redis storage and Centrifugo event delivery.

This initial commit prepares the stack, local backend health endpoint, service connection helpers, private credential setup and implementation plan. The playable lobby and frontend are not implemented yet.

## Local setup

Requires Node.js 22.12+ (Node 24 recommended) and npm. From the repository root:

```powershell
npm install
npm test
npm run check:services
npm run dev:backend
```

The generated `.env.local` is already installed on the original development PC and is ignored by Git. On another machine, copy `.env.example` to `.env.local` and obtain PixelPlaza-specific keys privately. Never reuse SchedSnap or starter keys.

Backend health: `http://127.0.0.1:3001/health`. Run servers in the foreground and stop with Ctrl+C. `check:services` verifies Redis isolation and live WebSocket delivery using disposable, expiring test data; it requires internet access and running VM services.

## Documentation

- [Implementation plan](documentation/PLAN.md)
- [Architecture and data flow](documentation/ARCHITECTURE.md)
- [Technology choices](documentation/TECH_STACK.md)
- [Local development and secrets](documentation/LOCAL_DEVELOPMENT.md)
- [Future deployment to the VM](documentation/VM_DEPLOYMENT.md)

No PixelPlaza backend has been deployed to the VM yet. Documentation stays in this repository; the future backend directory is `~/apps/pixelplaza`.
