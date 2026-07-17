# MultiGames — Sudoku + Wordle + Cards 🧩

A minimalist, accessible multiplayer game room built with
**React + TypeScript + Vite** on the front end and **[PartyKit](https://partykit.io)**
for real-time multiplayer.

Players choose Sudoku, Wordle, or the "She's a 2" card game from a landing page after
joining a room. They can share one Sudoku board, race or team up on daily Wordle, see
each other's masked Wordle boards, play a pass-&-play card guessing game, and chat in a
side panel (desktop) / bottom panel (mobile).

## Features

- **Real-time shared board** — every fill is broadcast to all players instantly.
- **Live presence** — see which cell each other player has selected, color-coded with initials.
- **Chat** — responsive panel: sidebar on desktop, stacked below the board on mobile.
- **Accessible** — full keyboard play (arrow keys to move, `1–9` to fill, `Backspace` to clear),
  ARIA grid roles, visible focus rings, and color choices paired with text/initials so meaning
  never depends on color alone.
- **Unique-solution puzzles** — generated server-side with a uniqueness check; three difficulties.
- **Conflict highlighting** — duplicate numbers in a row/column/box are flagged (color + underline).
- **Game landing page** — choose Sudoku or Wordle before entering the active room view.
- **Daily Wordle** — original public Wordle answer schedule, Wordle-style colors/keyboard,
  race/team modes, and standings by guesses then time.
- **Private letters** — each player sees their own Wordle letters; everyone else only sees
  colored result tiles and progress.
- **"She's a 2" card game** — a describer/guesser card game with pass-&-play (local) and
  multiplayer modes; players collect cards and the most cards wins.

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
  wordle.ts     Daily answer schedule + Wordle scoring
  cards.ts      Deck + card types; cardsGame.ts holds "She's a 2" game logic
  protocol.ts   WebSocket message types (ClientMessage / ServerMessage)
party/
  server.ts     PartyKit room server: holds game state + players + chat, broadcasts updates
src/
  App.tsx       Layout + glue
  components/    Board, Wordle, Cards, CardsSetup, Chat, Players, Controls, Join
  lib/
    usePartyGame.ts  React hook wrapping the PartySocket connection + state
    colors.ts        Palette + helpers (initials, readable text color)
```

The PartyKit server keeps authoritative game state **in memory per room**. Clients send intents
(`join`, `cursor`, `fill`, `chat`, `reset`, `switchGame`, `wordleGuess`, `wordleReset`)
and the server validates them and broadcasts the results (`snapshot`, `values`, `game`,
`players`, `chat`, `reset`). Wordle snapshots are personalized per connection so opponent
letters are never sent to other clients.

## Configuration

- `VITE_PARTYKIT_HOST` — host the client connects to (defaults to `localhost:1999`). Set this to
  your deployed PartyKit host in production.

## Ideas for next iterations

- Persist board/chat across restarts (PartyKit storage / Durable Object alarms).
- Live "ghost" cursor while typing, pencil-mark notes, and undo.
- Win celebration + per-room scoreboards and timers.
- Room creation UI and shareable room codes.
