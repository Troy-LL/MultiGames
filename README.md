# Multiplayer Sudoku 🧩

A minimalist, accessible multiplayer Sudoku built with **React + TypeScript + Vite** on the
front end and **[PartyKit](https://partykit.io)** for real-time multiplayer.

Players in the same room share one board, see **where everyone is selecting** in real time,
and chat in a side panel (desktop) / bottom panel (mobile).

## Features

- **Real-time shared board** — every fill is broadcast to all players instantly.
- **Live presence** — see which cell each other player has selected, color-coded with initials.
- **Chat** — responsive panel: sidebar on desktop, stacked below the board on mobile.
- **Accessible** — full keyboard play (arrow keys to move, `1–9` to fill, `Backspace` to clear),
  ARIA grid roles, visible focus rings, and color choices paired with text/initials so meaning
  never depends on color alone.
- **Unique-solution puzzles** — generated server-side with a uniqueness check; three difficulties.
- **Conflict highlighting** — duplicate numbers in a row/column/box are flagged (color + underline).

## Getting started

```bash
npm install
npm run dev
```

`npm run dev` runs **both** servers together:

- Vite (web app) on http://localhost:5173
- PartyKit (multiplayer server) on http://localhost:1999

Open the app in two tabs (or share the **invite** link) to play together. Rooms are chosen via
the `?room=<name>` query param (defaults to `lobby`).

### Useful scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Run web + PartyKit dev servers together |
| `npm run dev:web` | Vite only |
| `npm run dev:party` | PartyKit only |
| `npm run lint` | ESLint |
| `npm run build` | Type-check + production build |
| `npm run deploy` | Deploy the PartyKit server (requires `npx partykit login`) |

## Architecture

```
shared/         Code shared between client and server
  sudoku.ts     Puzzle generation, solving, conflict detection
  protocol.ts   WebSocket message types (ClientMessage / ServerMessage)
party/
  server.ts     PartyKit room server: holds board + players + chat, broadcasts updates
src/
  App.tsx       Layout + glue
  components/    Board, Chat, Players, Controls, Join
  lib/
    usePartyGame.ts  React hook wrapping the PartySocket connection + state
    colors.ts        Palette + helpers (initials, readable text color)
```

The PartyKit server keeps authoritative game state **in memory per room**. Clients send intents
(`join`, `cursor`, `fill`, `chat`, `reset`) and the server validates them and broadcasts the
results (`snapshot`, `values`, `players`, `chat`, `reset`).

## Configuration

- `VITE_PARTYKIT_HOST` — host the client connects to (defaults to `localhost:1999`). Set this to
  your deployed PartyKit host in production.

## Ideas for next iterations

- Persist board/chat across restarts (PartyKit storage / Durable Object alarms).
- Live "ghost" cursor while typing, pencil-mark notes, and undo.
- Win celebration + per-room scoreboards and timers.
- Room creation UI and shareable room codes.
