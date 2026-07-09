# P-006: Interactive Simulation Cockpit

**Proposed by:** Meta Platform (inspired by Cosmogonic Mechalogodrom's real-time interactive cosmic playground)
**Status:** TBA — placeholder for future Phase 3/4 product work
**Date:** 2026-07-09
**Prerequisite:** P-005 (Cadenced Tick Pipeline + Sector Contracts) must land first

---

## Vision

Kronos Engine currently operates in **batch mode**: define experiment → run N seeds → analyze CSV outputs. This proposal describes an **interactive mode** — a real-time simulation cockpit where a user can:

- Watch a running world evolve visually (sector state, cross-sector events, sentinel outputs)
- Pause/resume at any tick
- Inject interventions mid-run (heatwave, war, policy change)
- Rewind to any prior tick and fork
- See live metric dashboards updating per-tick
- Export the current session as an experiment run

This mirrors the Cosmogonic Mechalogodrom's interactive cosmic playground — but for research-grade counterfactual simulation rather than A-Life art.

---

## Proposed Architecture

```
┌─────────────────────────────────────────────┐
│              SIMULATION ENGINE               │
│  (headless — runs in worker thread or child) │
├─────────────────────────────────────────────┤
│  tick() → tick() → intervention → tick() →  │
└──────────────────┬──────────────────────────┘
                   │ snapshots + metrics
                   ▼
┌─────────────────────────────────────────────┐
│           COCKPIT SERVER (HTTP/WS)           │
│  Live state broadcast, intervention relay,   │
│  snapshot/rewind API, experiment export       │
├─────────────────────────────────────────────┤
                   │ JSON + WebSocket
                   ▼
┌─────────────────────────────────────────────┐
│           COCKPIT UI (web dashboard)          │
│  World map, sector gauges, event log,        │
│  timeline scrubber, intervention panel        │
└─────────────────────────────────────────────┘
```

---

## Scope (when picked up)

- **Phase 3 scope:** Counterfactual Query Engine — the API/backend layer
- **Phase 4 scope:** Interactive cockpit with real-time WebGL visualization (if desired)
- **Not in Phase 3:** A full WebGL 3D world renderer like Cosmogonic's. The cockpit would use 2D maps + gauges + timelines, not a 3D scene.

---

## Open Questions (to resolve when scoping)

1. WebSocket or SSE for live state broadcast?
2. Browser-based dashboard or terminal-based TUI?
3. How much experiment state to keep in memory vs persist to disk?
4. Does the cockpit need to run the simulation in-process (shared memory) or out-of-process (IPC)?

---

*This proposal is intentionally brief. It exists to reserve the proposal number and stake the concept. Expand when Phase 2 completion triggers Phase 3 planning.*
