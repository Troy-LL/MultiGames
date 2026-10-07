# TICK 1 — dead-code / redundancy removal

## Scope
Remove dead + redundant code (all deletions, no behavior change). Executor subagent implemented; orchestrator verified + audited.

## Changes (5 files, all deletions)
- `src/lib/usePartyGame.ts` — removed dead `join` public API (interface field, callback, return, dep). Never destructured; identity announced via effect.
- `shared/protocol.ts` — removed unread `SudokuSnapshot.puzzle` field.
- `party/server.ts` — removed `puzzle` from `sudokuSnapshot()`; (audit re-scope) removed now-dead `sudokuPuzzle` class field + its assignment.
- `src/App.tsx` — removed redundant inline `switchGame` double-send in `handleChooseGame` + `handleChooseCardsMode` (effect at ~171 owns it); removed duplicate `setCardsPlayMode(null)`.

Diff: ~4 insertions / ~18 deletions.

## Verify (orchestrator-run, not trusting subagent)
- `npm run lint` — PASS (exit 0).
- `npm run build` (tsc -b + vite) — PASS. bundle 247.52 kB / gzip 76.16 kB (down from 247.66).
- Playwright — 2/2 PASS (solo flow + 2-session sudoku sync) after both executor edit AND audit re-scope edit.
- Screenshots — regenerated, UI intact (landing, join, board+numpad, 2 mp sessions with presence+conflict). No dead buttons/orphan labels.

## Audit
ponytail self-audit of diff: all deletions, no new abstractions. One finding — `sudokuPuzzle` became write-only after removing snapshot use → re-scoped into this tick and removed. No new critical bloat.

## Confidence: 0.95 — SUCCESS
0.5 +0.10 lint +0.15 build +0.20 e2e +0.15 screenshots +0.10 audit-clean = capped ~0.95 (small margin: `party/` is eslint-checked but not full tsc-typechecked by `build`; PartyKit compiles it at dev/deploy — e2e exercised the live server and passed).
