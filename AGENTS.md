# PixelPlaza agent rules

- The initial target is one 10-player lobby. Follow `documentation/PLAN.md`; distinguish implemented routes/features from planned ones.
- Backend development is local until deployment is explicitly requested. Redis and realtime are shared VM infrastructure with PixelPlaza-specific credentials.
- Keep credentials in ignored `.env.local` or production env files. `.env.example` must contain placeholders only. Never expose project keys in the frontend or commit real secrets.
- Whenever changing the VM, update both relevant PixelPlaza documentation and the maintained local VM documentation at `C:\Users\picar\Desktop\azure_vm`. Read that folder's `AGENTS.md` first. Documentation stays local.
- VM Redis credential exports follow `PROJECT.redis.env`; PixelPlaza's file is `~/redis/pixelplaza.redis.env`.
- Run dev servers in the foreground and stop them cleanly before ending a session. Preserve `node_modules`; do not use forced installs or delete dependency state as cleanup.
