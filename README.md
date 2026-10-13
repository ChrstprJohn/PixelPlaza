# PixelPlaza

A planned pixel-art multiplayer plaza with **10 players per lobby**. React and Phaser render the game; a Node backend validates movement and chat; your Azure VM supplies isolated Redis storage and Centrifugo event delivery.

The local prototype is playable: landing page, guest name/character picker, walking, a 10-player lobby, temporary chat and six-second speech bubbles. The local Node backend validates guest sessions and movement; VM Redis holds expiring sessions, limits, chat and latest-state snapshots. Centrifugo delivers live updates.

## Local setup

Requires Node.js 22.12+ (Node 24 recommended) and npm. From the repository root:

```powershell
npm install
npm test
npm run check:services
npm run dev:backend
```

In a second foreground terminal, run `npm run dev:frontend`, then open **http://localhost:5173**. Open multiple tabs to test guests together. Both servers bind to loopback, so other computers cannot join. Use WASD/arrows after clicking the map, or hold touch arrows on a small screen. Keyboard input does not move the character while typing chat.

With both servers running, `npm run check:lobby` checks the real Redis/realtime lobby, temporary chat expiry and the 10-player cap using disposable guests. Stop both terminals with Ctrl+C when finished.

The generated `.env.local` is already installed on the original development PC and is ignored by Git. On another machine, copy `.env.example` to `.env.local` and obtain PixelPlaza-specific keys privately. Never reuse SchedSnap or starter keys.

Backend health: `http://127.0.0.1:3001/health`. Run servers in the foreground and stop with Ctrl+C. `check:services` verifies Redis isolation and live WebSocket delivery using disposable, expiring test data; it requires internet access and running VM services.

## Documentation

- [Implementation plan](documentation/PLAN.md)
- [Architecture and data flow](documentation/ARCHITECTURE.md)
- [Technology choices](documentation/TECH_STACK.md)
- [Local development and secrets](documentation/LOCAL_DEVELOPMENT.md)
- [Future deployment to the VM](documentation/VM_DEPLOYMENT.md)

No PixelPlaza backend has been deployed to the VM yet. Documentation stays in this repository; the future backend directory is `~/apps/pixelplaza`. Chat keeps only the last 60 messages and expires after 15 minutes without a new message. A backend restart creates a fresh lobby; see [temporary storage rules](documentation/TEMPORARY_STORAGE.md).
