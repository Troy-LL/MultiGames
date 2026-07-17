# TICK 2 — UI correctness fixes

## Scope
Fix data-loss UX bug + stale label. Small enough that orchestrator edited inline (2 one-liners) rather than dispatching an executor — logged deviation to keep context lean.

## Changes (2 src files + 1 e2e)
- `src/components/Wordle.tsx` (~line 282) — **bug fix**: mode buttons called `onReset(nextMode)` unconditionally; clicking the ALREADY-ACTIVE mode wiped the board (server always resets). Guarded: `onClick={() => nextMode !== mode && onReset(nextMode)}`. Root cause fixed at the button; cross-mode switch still resets (intended).
- `src/components/Join.tsx` (~line 28) — stale subtitle listed only "Sudoku or daily Wordle"; added "or She's a 2" for parity with landing copy.
- `e2e/screens.spec.ts` — new regression: join Wordle, submit a guess (standings → 1/6), click the active mode, assert standings still 1/6 (would read 0/6 if board reset). Runnable check for the guard.

## Verify (orchestrator-run)
- `npm run lint` — PASS (exit 0).
- `npm run build` — PASS.
- Playwright — 3/3 PASS (sudoku solo, wordle guard, 2-session sync).
- Screenshot — `06-wordle-after-guess.png`: CRANE registered with correct/present/absent marks, keyboard colored, standings 1/6, Race active. Guess persisted after clicking Race.

## Audit
Both edits are minimal (1 guard + 1 string). No new abstractions/bloat. ponytail-clean.

## Confidence: 0.90 — SUCCESS
0.5 +0.10 lint +0.15 build +0.20 e2e +0.15 screenshots +0.10 audit-clean, minus small margin: did not run explicit red-green (revert) to prove the guard test fails without the fix — assertion (1/6 vs reset 0/6) is nonetheless meaningful and observed green with fix in place.
