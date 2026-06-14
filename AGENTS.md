# AGENTS.md

## Cursor Cloud specific instructions

This is a single static front-end SPA — the **Student Retention Model** (React 19 + TypeScript + Vite 8). There is no backend, database, API, or environment variables; all data is local JSON bundled at build time (`data/subjects/*.json`, `public/data/subjects/*.json`).

### Service: web app (the entire product)
- Dev server: `npm run dev` (Vite, serves on `http://localhost:5173/`). This is the only service needed to develop/test end to end.
- Lint: `npm run lint` (ESLint).
- Build: `npm run build` (`tsc -b && vite build`, outputs to `dist/`).
- Preview production build: `npm run preview`.

### Notes / caveats
- Node 22 is required (pinned by `netlify.toml` and `.github/workflows/ci.yml`).
- `npm run lint` currently reports 3 pre-existing errors in committed code (`src/components/Analytics/RetentionAreaChart.tsx` `no-explicit-any` ×2, `src/main.tsx` `react-refresh/only-export-components`). These are code issues, not environment issues; CI runs `npm install`, `npm run lint`, `npm run build`.
- There are no automated test suites; "testing" means running the dev server and interacting with the UI (graph rendering, timeline play/scrub, clicking subject nodes to open the detail panel).
- `tools/generate_layout.py` is a standalone Python 3 (stdlib-only) authoring script to regenerate curriculum layout JSON; not part of the running app.
