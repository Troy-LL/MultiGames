# SCOPE DECISIONS

## Baseline
- Real project root: `MultiGames/` (parent dir only wraps it).
- Games present: Sudoku, Wordle, Cards (local + party). README mentions only Sudoku+Wordle.
- No git commit/push/add this session.

## Tick 1 — dead-code / redundancy removal (all deletions)
IN:
- Remove dead public API `join` from usePartyGame.ts (never destructured; identity announced via effect).
- Remove transmitted-but-unread `SudokuSnapshot.puzzle` (protocol.ts + server.ts sudokuSnapshot).
- Remove redundant inline `switchGame` double-send in App.tsx handleChooseGame/handleChooseCardsMode (effect already owns it).
- Remove duplicate `setCardsPlayMode(null)` noise in App.tsx handleChooseGame.
OUT/DEFERRED:
- reset/game protocol merge (#1) — touches broadcast semantics, defer.
- Cards.tsx possibly-dead Draw branch (#6) — needs live-state confirmation, defer.
- Wordle destructive mode reset (#8) + stale Join subtitle (#7) → Tick 2.
Verify: lint, build, Playwright (solo+2-session), screenshots.

## Tick 2 — UI correctness (Wordle mode reset bug + Join subtitle)
IN: guard Wordle active-mode click (no board wipe); Join subtitle add "She's a 2"; +wordle e2e.
Deviation: edited inline (2 one-liners) instead of executor subagent — logged, keeps context lean.
OUT: everything else stays backlog.

## Deferred (backlog)
- #1 reset/game protocol merge (server broadcast semantics) — safe-ish dedup, not yet done.
- #6 Cards.tsx possibly-dead "Draw" branch (Cards.tsx ~295) — needs live describing-no-card state confirm.
- Deep-link asymmetry: only ?game=cards honored; ?game=wordle/sudoku fall through to landing.
- npm audit vulns (3 mod, 1 high).
