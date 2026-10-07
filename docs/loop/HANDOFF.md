# HANDOFF — MultiGames work ×2 (no git ship)

Date: 2026-07-16. No git commit/push/add performed. Changes live in working tree only.

## Files touched
Source (6 files, net −14 lines):
- `party/server.ts` — removed unread `puzzle` from snapshot + now-dead `sudokuPuzzle` field/assignment.
- `shared/protocol.ts` — removed unread `SudokuSnapshot.puzzle`.
- `src/App.tsx` — removed redundant `switchGame` double-sends + duplicate `setCardsPlayMode(null)`.
- `src/lib/usePartyGame.ts` — removed dead `join` public API.
- `src/components/Wordle.tsx` — **bug fix**: guard active-mode click so it no longer wipes the board.
- `src/components/Join.tsx` — subtitle parity ("or She's a 2").

New (test harness, untracked):
- `playwright.config.ts`, `e2e/screens.spec.ts`, `docs/loop/*`, `docs/loop/shots/*.png`, `test-results/`.
- Added devDep `@playwright/test` + chromium browser.

## Gate results + confidence
| Tick | Scope | lint | build | Playwright | screenshots | audit | Confidence | Result |
|------|-------|------|-------|-----------|-------------|-------|-----------|--------|
| 1 | dead-code/redundancy removal | ✅ | ✅ | 2/2 ✅ | ✅ | clean (1 finding re-scoped+fixed) | 0.95 | SUCCESS |
| 2 | Wordle mode-reset bug + Join label | ✅ | ✅ | 3/3 ✅ | ✅ | clean | 0.90 | SUCCESS |

Both ticks cleared the 0.80 threshold with all hard gates green.

## Verification notes
- Playwright boots real `npm run dev` (vite+partykit); 2-session test proves live multiplayer sudoku sync.
- Wordle guard has a dedicated regression test (standings stays 1/6 after clicking active mode).
- Caveat: `party/` is eslint-checked but not full-tsc-typechecked by `npm run build` (PartyKit compiles it separately); e2e exercises the live server, so runtime path is covered.

## Open backlog (from audit + investigator)
1. `reset`/`game` server→client message dedup (identical payload+handling) — `shared/protocol.ts`, `party/server.ts:~450`, `usePartyGame.ts`. Deferred (broadcast semantics).
2. Possibly-dead "Draw" branch in `src/components/Cards.tsx:~295` — needs live describing-with-no-card state confirm.
3. Deep-link asymmetry: only `?game=cards` honored; `?game=wordle|sudoku` fall through to landing (`App.tsx:46-49`).
4. `npm audit`: 4 vulns (3 moderate, 1 high).

## Follow-up session — PartyKit debug + UX review
- **PartyKit lobby debug** (`TICK-3-partykit-debug.md`): stress/race/reconnect harnesses prove init is reliable in dev (no deterministic bug reproduced). Root of the *experienced* failure = unhandled connection/snapshot failure hung silently. Added connection **watchdog + Retry** (`usePartyGame.ts` `stalled`/`reconnect`, `App.tsx` `ConnectionTrouble`, `index.css`). Conf 0.88.
- **UX review** (`UX-REVIEW.md`): applied frontend-design lens. Fixed cards "?" ×8 swatch bug (`CardsSetup.tsx`). Recommendations logged (no in-product lobby creation, dead-looking numpad, hero isn't the thesis).
- New e2e: `lobby-stress`, `lobby-race`, `ux-capture`, `resilience: stalled connection`. **Full suite 9/9 PASS.** lint + build green.
- Files touched this session: `src/lib/usePartyGame.ts`, `src/App.tsx`, `src/components/CardsSetup.tsx`, `src/index.css` + 3 new e2e specs.

## Top backlog after this session
1. Deploy: fail loudly if `VITE_PARTYKIT_HOST` missing in prod build (likely real cause of "sometimes doesn't work").
2. Add in-product "Create room" / room-name UI (no lobby-creation affordance today).
3. Sudoku numpad: hint/affordance so it doesn't read as dead pre-selection.
4. Verify Durable Object hibernation doesn't regenerate the puzzle on wake.
5. `?game=wordle|sudoku` deep-link parity; `prefers-reduced-motion`; earlier: reset/game msg dedup, Cards dead Draw branch, npm audit vulns.

READY_FOR_HEALTH_WATCH
