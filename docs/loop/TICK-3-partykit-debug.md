# PartyKit lobby-creation debug (systematic-debugging)

## Reported symptom
"Sometimes lobby creation doesn't work."

## Phase 1 — reproduction (evidence, not guessing)
Built 3 Playwright reproduction harnesses against the live dev server (vite+partykit):
- `e2e/lobby-stress.spec.ts` — 10 fresh rooms sequentially → **10/10** reached a populated board (grid + ≥10 clues).
- `e2e/lobby-race.spec.ts` — 4 clients hitting ONE brand-new room simultaneously → all 4 got a populated board + roster converged to 4. Rapid reconnect (5× reload same room) → board stays populated.
Result: **lobby init is reliable in dev** — no deterministic failure reproduced.

## Phase 2/3 — code investigation
- `party/server.ts` `onStart` → `newSudokuGame/resetWordle/resetCards` are synchronous; PartyKit awaits `onStart` before `onConnect`, so the snapshot always carries a valid game. No null path in `snapshotFor`.
- `shared/sudoku.ts` `generatePuzzle` — all loops bounded, never throws / never infinite-loops. Not a source of intermittency.
- Client `usePartyGame.ts` — `onOpen` sets `online`; game arrives only via `snapshot`. **There was no timeout/error/retry anywhere.**

## Root finding
No deterministic code bug in the happy path. The reported "sometimes doesn't work" maps to an **unhandled failure mode**: whenever the socket connects but the snapshot never arrives (wrong deploy host, dropped init message, cold Durable Object, flaky network), the app hung **forever** — board stuck on `"Loading game…"`, landing stuck on `"Connecting…"`, with no feedback and no way to recover.

Likely production trigger: `VITE_PARTYKIT_HOST` unset at build → client dials `localhost:1999` → silent hang. (Documented in AGENTS.md but not surfaced to users.)

## Fix (defense-in-depth, root of the *experienced* failure)
- `src/lib/usePartyGame.ts` — connection **watchdog**: 8s after we're not "ready" (`online && game != null`), set `stalled`; cleared on snapshot / reconnect. Added `stalled` + `reconnect()` (calls `socket.reconnect()`) to the hook API.
- `src/App.tsx` — new `ConnectionTrouble` (role="alert") replaces the silent "Loading game…"; landing status pill gains a **Retry** when stalled.
- `src/index.css` — styles.

## Verify
- lint PASS, build PASS.
- Playwright **7/7 PASS**, incl new `resilience: stalled connection surfaces a Retry` (routeWebSocket accepts socket, never replies → Retry appears within watchdog window). Screenshot `07-connection-trouble.png` confirms.
- Existing stress/race/sync/wordle tests still green → watchdog does not false-trip on normal fast connects.

## Confidence: 0.88
Gates green; real recovery UX added + proven. Margin: could not reproduce a hard init bug (so can't 100% confirm it was the user's exact cause); watchdog threshold (8s) is a tunable heuristic.

## Backlog surfaced
- Deploy checklist: fail loudly if `VITE_PARTYKIT_HOST` is missing in a production build.
- Durable Object hibernation: `onStart` re-running would regenerate the puzzle / reset state on wake — verify against deployed behavior.
