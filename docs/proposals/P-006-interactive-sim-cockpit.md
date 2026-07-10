# P-006: Interactive Simulation Cockpit

**Proposed by:** Meta Platform
**Status:** Active spec — ready for implementation
**Date:** 2026-07-10
**Prerequisite:** Phase 3 API (`src/api/server.ts`) is live. Cockpit consumes it.

---

## Vision

A browser-based dashboard that talks to the Phase 3 API. No 3D, no real-time engine loop — think experiment workbench, not video game.

---

## Architecture

```
Browser (HTML + JS) ──HTTP──> API Server (:3001) ──> Engine
       │                                                 
       └── experiment config, run status, results, export
```

The cockpit is a **single HTML file** (or small static bundle) served by the API server. Uses `fetch()` against the same origin. No build step, no framework.

---

## Pages / Views

### 1. Dashboard home (`GET /`)
- Server status: uptime, version, sector list, era count
- Quick experiment form: pick rewind point, set ticks/seeds, add intervention
- Recent experiments list with status badges

### 2. Experiment detail (`GET /experiment/:id`)
- **Status bar:** queued → running (progress %) → done / failed
- **Run table:** one row per seed, expandable to see per-sector diffs
- **Summary card:** mean, stdDev, Cohen's d per metric, significant flagged
- **Export buttons:** JSON, CSV downloads

### 3. Era browser (`GET /eras`)
- All era files with their rewind points
- Click a rewind point → pre-fill the experiment form

---

## Implementation

### Server-side
- Add `GET /` route to `src/api/server.ts` that serves `index.html`
- Add `GET /experiment/:id`, `GET /eras` routes (or reuse existing API + add HTML views)

### Frontend (single HTML file)
- `src/api/index.html` — served as static file
- Uses vanilla JS + CSS (no framework, no build step)
- Fetch-based: `fetch('/api/status')`, `fetch('/api/experiments')`, `POST /api/experiments`
- CSS-only styling (dark theme, monospace, glass panels)
- Polling for experiment status (no WebSocket for v1)

### Deliverables
1. `src/api/index.html` — the cockpit UI (single file, ~300 lines)
2. `GET /` route in `src/api/server.ts` — serves the HTML
3. `GET /eras` HTML view — optional, could be client-side rendered from `/api/eras`

---

## Effort

- `index.html`: ~3h (layout, fetch wiring, experiment form, results display)
- Server route: ~15 min
- Testing: ~30 min
- **Total: ~4h**

---

## Not in scope

- Real-time WebSocket streaming (Phase 4 if needed)
- WebGL 3D visualization (separate project)
- Auth, user accounts (single-user for now)
- SQLite cache (can be added later)
