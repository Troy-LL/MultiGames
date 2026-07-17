# TICK-4 — Hibernation & puzzle regeneration

## Question
Does PartyKit hibernation cause the shared Sudoku puzzle to regenerate (swap
under players mid-game)?

## Findings
- **Hibernation is OFF.** `partykit.json` sets no hibernation option and
  `party/server.ts` declares no `static options = { hibernate: true }`.
  Hibernation is opt-in in PartyKit, so the room instance stays warm and all
  in-memory state (`sudokuValues`, versions, players, chat) persists between
  messages. `onStart` runs once for the life of the warm instance.
- **`onStart` is now idempotent.** It early-returns when `sudokuVersion > 0`,
  so even a duplicate `onStart` on a warm instance can't regenerate the board.
- **Warm-room persistence is already covered by e2e**:
  `lobby-race.spec.ts` → "rapid reconnect keeps the board populated" reconnects
  5× and the board stays populated with the same puzzle.

## Caveat (documented in server.ts)
All state is in instance fields, not `room.storage`. If hibernation is ever
enabled, the instance is destroyed on sleep and these fields reset to `0` on
wake — `onStart` would then regenerate the puzzle. Enabling hibernation
therefore requires persisting state to `room.storage` first. Not done now
(YAGNI: hibernation is off).

## Verdict
No regeneration risk in the current configuration. Verified by config
inspection + the idempotency guard + existing reconnect e2e.
