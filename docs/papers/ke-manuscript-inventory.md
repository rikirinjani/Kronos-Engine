# KE Manuscript Inventory — Read-Only Reconnaissance

**Date:** 2026-09-08
**Author:** Orchestrator (synthesized from exp-2 explorer + fix-3 reconciler)
**Scope:** Read-only inventory of KE manuscript state, evidence gaps, and blocking issues
**Status:** BLOCKED — see B1 below

---

## 1. File Inventory

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `jamia-2026-kronos-engine.md` | 443 | **Canonical (designated)** | Contains Phase F §3.3, but with **stale/incorrect framing** — reports Windows non-canonical numbers (mean Δ=0.034) instead of Mac canonical results (Δ=0.219, mean Δ=0.044 per VER-2026-019) |
| `jamia-2026-kronos-engine(7).md` | 460 | **UNTRACKED working copy** | Contains correct, VER-matched Phase F (seed-46 Δ=0.219, event-gate mechanism, 333/333 Mac / 332/333 Windows). Never committed. |
| `jamia-2026-kronos-engine-v1-draft.md` | — | Superseded | Historical draft |
| `jamia-2026-kronos-engine-v2-redraft.md` | — | Superseded | Historical draft |
| `jamia-2026-kronos-engine-v3-redraft2.md` | — | Superseded | Historical draft |
| `jamia-2026-kronos-engine-v4-agent-reviewed.md` | — | Superseded | Historical draft |
| `drafts/phase-f-draft.md` | 121 | Merge instructions | Contains stale "212 metrics" (should be 199); SupplyStress 0.219 (Mac) vs 0.17 (Windows) correctly labeled |
| `drafts/ke-manuscript-outline.md` | — | Outline | Not reviewed in this pass |

---

## 2. Section Structure (canonical manuscript)

| # | Section | Lines | Status | Notes |
|---|---------|-------|--------|-------|
| — | Title / Authors / Affiliation | 1–10 | ✅ OK | "Independent Research" |
| 1 | Abstract | 11–47 | ✅ OK | ~300 words, structured |
| 2 | Introduction | 50–92 | ✅ OK | Gap → contribution → validation preview |
| 3.1 | Architecture | 96–266 | ✅ OK | 30→167 seeds, KE modules, sentinel adapter |
| 3.2 | Experimentation Framework | 267–299 | ✅ OK | Atomicity guarantee, 7 quality gates |
| 3.3 | Counterfactual Results | 301–381 | ⚠️ **BLOCKED** | Phase F reports stale Windows numbers; see B1 |
| 4 | Discussion | 382–413 | ✅ OK | 4 insights, threats |
| 5 | Limitations | 414–432 | ✅ OK | 5 acknowledged |
| — | References | 433–443 | ✅ OK | |

---

## 3. Numerical Values (cross-referenced)

| Value | Canonical | (7).md | Experiment | Status |
|-------|-----------|--------|------------|--------|
| Seeds: pre/post | 30 → 167 | 30 → 167 | 30 → 167 | ✅ |
| SEIRV compartments | 8 | 8 | 8 | ✅ |
| Quality gates | 7 | 7 | 7 | ✅ |
| Timeline extent | 2019–2025 | 2019–2025 | 2019–2025 | ✅ |
| Regimen rollouts | 2 | 2 | 2 | ✅ |
| Daily resolution | Yes | Yes | Yes | ✅ |
| Handler count (main pipeline) | 38 | 38 | 38 | ✅ |
| KE-SR handler count | 15 | 15 | 15 | ✅ |
| Total handlers | 45 | 45 | 45 | ✅ |
| Sector files (TS + test) | 6 | 6 | 6 | ✅ |
| SEIR Compartments | 8 | 8 | 8 | ✅ |
| Canonical execution metric | mean Δ=0.034 | **mean Δ=0.044** | **mean Δ=0.044** | ⚠️ Canonical stale |
| SupplyStress delta (Mac, seed-46) | 0.219 (in canonical 3.3) | 0.219 | 0.219 | ✅ value exists but framing wrong |
| SupplyStress delta (Windows, seed-46) | 0.17 | 0.17 | 0.17 | ✅ non-canonical only |
| Mac regression | 333/333 | 333/333 | 333/333 (VER-2026-019) | ✅ |
| Windows regression | — | 332/333 | 332/333 | ✅ |
| DR regression | 127/127 | 127/127 | 127/127 | ✅ |
| Phase F tests | 9/9 | 9/9 | 9/9 | ✅ |
| SEIRV Compartments | 8 | 8 | 8 | ✅ |
| Behavioral Compartments | 6 | 6 | 6 | ✅ |
| Beds (KE) | 133 | 133 | 133 | ✅ |
| Metrics computed | 199 | 199 | 199 | ✅ (draft has stale "212") |

---

## 4. Phase F Evidence Status

| Claim | Evidence | Verified |
|-------|----------|----------|
| Mac canonical: seed-46 Δ=0.219, mean Δ=0.044 | VER-2026-019 (QMS) | ✅ |
| Event-gate mechanism (exogenous shock → subcompartment travel time → supply chain) | report.md §7.2 | ✅ |
| 333/333 Mac, 332/333 Windows | VER-2026-019, report.md | ✅ |
| DR 127/127 | VER-2026-019 | ✅ |
| Phase F tests 9/9 | report.md | ✅ |
| Replay identical | VER-2026-019 | ✅ |
| Non-coding artifact | git status | ✅ |
| **Stale: canonical reports mean Δ=0.034** | **Should be 0.044** | ⚠️ **BLOCKER** |

---

## 5. Blocking Issues

### B1: Canonical Manuscript Phase F Section is Stale [BLOCKING]
- **Location:** `jamia-2026-kronos-engine.md` §3.3 (lines 301–381)
- **Problem:** Reports `mean Δ = 0.034` (Windows non-canonical result). The canonical Mac result is `mean Δ = 0.044` (seed-46 Δ=0.219). This contradicts VER-2026-019 which designates the Mac run as canonical.
- **Correct content:** Exists in `jamia-2026-kronos-engine(7).md` and should be ported from there.
- **Fix required:** Update §3.3 with VER-2026-019-matched causal-pathway content.
- **Impact:** Cannot proceed with scientific revision until this is resolved.

### B2: Phase F Draft Stale "212" Count [NON-BLOCKING]
- **Location:** `drafts/phase-f-draft.md` lines 19, 22
- **Problem:** Reports "212 metrics" — should be "199 metrics" (the actual count).
- **Fix required:** Change "212" → "199" in two places.

### B3: Untracked Working Copy [NON-BLOCKING]
- **Location:** `jamia-2026-kronos-engine(7).md`
- **Problem:** Contains correct Phase F content but is UNTRACKED (never committed). This is the source of truth for the fix to B1.
- **Action:** After B1 fix, reconcile (commit or discard).

---

## 6. Verdict

**BLOCKED — B1 must be resolved before KE scientific revision can proceed.**

The canonical manuscript's Phase F section reports the wrong numbers (Windows non-canonical instead of Mac canonical). The correct content exists in the untracked working copy. Once §3.3 is updated with the VER-2026-019-matched content, the manuscript will be ready for scientific language hardening (the same process applied to DR).

**Recommended next steps:**
1. Fix B1: Port correct Phase F content from `(7).md` to canonical `jamia-2026-kronos-engine.md` §3.3
2. Fix B2: Update `212` → `199` in `drafts/phase-f-draft.md`
3. Fix B3: Commit or discard `(7).md`
4. Proceed with KE scientific language hardening pass
