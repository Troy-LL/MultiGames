# AGENTS.md

## Cursor Cloud specific instructions

This repo is a **multiplayer Sudoku** app: a React + TypeScript + Vite front end with a
**PartyKit** WebSocket server for real-time multiplayer (shared board, live presence, chat).
See `README.md` for full architecture and scripts.

### Services
There are two dev services, started together by `npm run dev` (via `concurrently`):
- **Web (Vite)** on `http://localhost:5173` — script `dev:web`.
- **PartyKit server** on `http://localhost:1999` — script `dev:party`, entry `party/server.ts`, config `partykit.json`.

Run them individually with `npm run dev:web` / `npm run dev:party` when debugging one side.

### Non-obvious caveats
- **PartyKit state is in-memory per room.** Editing `party/` or `shared/` hot-reloads/restarts the
  PartyKit server, which **wipes the current board, players, and chat**. Reload browser tabs after a
  party-server restart so they re-sync.
- **A plain HTTP GET to the PartyKit server returns 500** (e.g. `curl localhost:1999/parties/main/lobby`).
  This is expected — the server only implements WebSocket handlers, not `onRequest`. A successful
  connection shows as `GET /parties/main/lobby 101 Switching Protocols` in the `[party]` logs.
- **Testing multiplayer** requires two independent sessions in the **same room**: open
  `http://localhost:5173/?room=<name>` in two windows (use one normal + one incognito so they get
  distinct connections). Room defaults to `lobby`.
- The client connects to `VITE_PARTYKIT_HOST` (defaults to `localhost:1999`); set it to the deployed
  PartyKit host for production.
- `tsc -b` (used by `npm run build`) type-checks `src/` and `shared/` but **not** `party/`; PartyKit
  type-checks/bundles `party/` itself at dev/build/deploy time. `shared/` is imported by both sides.
