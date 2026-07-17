# SIGNALS

## Baseline (2026-07-16)
- `npm install` — 229 pkgs, 4 vulns (3 mod, 1 high). OK.
- `npm run lint` — PASS (exit 0, clean).
- `npm run build` (`tsc -b && vite build`) — PASS. bundle 247.66 kB / gzip 76.19 kB.
- Playwright — installed (@playwright/test + chromium). Harness: `e2e/screens.spec.ts`, config boots `npm run dev`.
- e2e baseline — 2/2 PASS: solo landing→join→sudoku board; 2-session same-room sudoku sync (fill broadcasts, presence badge, conflict highlight, both players listed).
- Screenshots in `docs/loop/shots/`: 01-landing, 02-join, 03-sudoku-board, 04/05 mp sessions. UI verified working — no dead buttons/orphan labels in captured views.

## Tick 1 (2026-07-16) — SUCCESS, conf 0.95
- lint PASS, build PASS (bundle 247.52 kB), Playwright 2/2 PASS, screenshots intact.
- 5 files, all deletions (~18 lines). No regressions. Audit re-scoped 1 dead field into tick.

## Tick 2 (2026-07-16) — SUCCESS, conf 0.90
- lint PASS, build PASS, Playwright 3/3 PASS (added wordle guard test), screenshot 06 confirms guess persists.
- Fixed Wordle destructive mode-reset bug + stale Join subtitle. 2 src files, 1 e2e added.
