# KE Phase F Reconciliation Report

**Date:** 2026-09-08
**Task:** B1 — Port correct Phase F content into canonical manuscript
**Scope:** Reconciliation only. No new scientific revisions, no new experiments.

---

## Blocking Issues Resolved

| ID | Issue | Status | Resolution |
|----|-------|--------|------------|
| B1 | Canonical §3.3 reports stale Windows mean Δ = 0.034 instead of Mac canonical 0.044 | ✅ RESOLVED | Ported correct Phase F content from (7).md into canonical §3.3. All values now match VER-2026-019 source of truth. |
| B2 | phase-f-draft.md references 212 metrics instead of 199 | ✅ RESOLVED | Fixed 212→199 on both "current" and "replace with" lines. |
| B3 | Untracked (7).md with correct Phase F content | ✅ RESOLVED | All Phase F content ported. (7).md can be discarded. See disposition below. |

---

## Sections Changed

### §3.3 Experiment 3: Mechanistic Pilot — CO2 Concentration Intervention (Phase F)

**Before:** Reported stale Windows numbers (mean Δ = 0.034, SupplyStress signal described differently, no structural analysis). Missing: event-gate mechanism, admission-multiplier inertness, discharge-delay constraint.

**After:** Reports Mac canonical values from VER-2026-019:
- seed 46, Δ = 0.219
- mean Δ = 0.044, d = 0.45
- direction consistency = 0.2 (1/5)
- 41 extreme-weather events vs 39 in control
- Identical first-event ticks: [8, 4, 6, 6, 2]
- Three structural mechanisms blocking downstream propagation:
  1. Event-gate mechanism (event timing is seed-dependent, not CO₂-dependent)
  2. Admission-multiplier inertness (floor function structurally inert for isolated events)
  3. Discharge-delay constraint (4,320–10,080 DR ticks vs 200-tick observation horizon)
- Platform consistency note (Windows concordant)
- Interpretation as null clinical result with mechanistic insight

### §4.4 Limitations

**Added three Phase F limitation paragraphs:**
1. **Event-gate mechanism:** Climate events propagate to adapter-level supply-stress but hospital dynamics do not amplify this into clinical outcomes. Event triggering is deterministic and seed-dependent, not CO₂-dependent.
2. **Admission-multiplier inertness:** `floor(floor(rng × 3) × 1.3)` is structurally inert for isolated events — multiplier can only differentiate when multiple events compound within a single tick.
3. **Discharge-delay constraint:** DR discharge delay (4,320–10,080 ticks) exceeds 200-tick observation horizon. Temporal-scale mismatch between world-tick and hospital-tick horizons.

---

## Stale Content Removed

| Location | Stale Value | Replacement |
|----------|-------------|-------------|
| §3.3 | mean Δ = 0.034 (Windows) | mean Δ = 0.044 (Mac canonical) |
| §3.3 | SupplyStress narrative without structural analysis | Full structural analysis with 3 mechanisms |
| phase-f-draft.md | 212 metrics | 199 metrics |

---

## Canonical Values Present (Verified)

| Metric | Value | Source | Verified |
|--------|-------|--------|----------|
| Mean Δ | 0.044 | VER-2026-019, Mac execution | ✅ Line 305 |
| Seed-46 Δ | 0.219 | VER-2026-019, Mac execution | ✅ Line 305 |
| Direction consistency | 0.2 (1/5) | VER-2026-019 | ✅ Line 305 |
| d value | 0.45 | VER-2026-019 | ✅ Line 305 |
| Extreme-weather events | 41 vs 39 | VER-2026-019 | ✅ Line 305 |
| First-event ticks | [8, 4, 6, 6, 2] | VER-2026-019 | ✅ Line 305 |
| All 333 tests | 333 | Canonical | ✅ Line 455 |
| Phase F v1 / quarantined / invalid | Not present | N/A | ✅ No references found |

---

## (7).md Disposition

**Decision: DISCARD after this reconciliation.**

(7).md contained correct Phase F content (now ported) plus 4 additional general limitation paragraphs not in canonical:
1. Asymmetric coupling
2. Incomplete war-event reversibility
3. Snapshot restore fidelity
4. No defensible micro→macro consumer

These 4 limitations are NOT Phase F content — they are general architectural limitations outside the scope of this reconciliation. They can be evaluated and added in a separate future editing pass if desired.

All Phase F content has been fully ported. (7).md has no remaining unique Phase F content.

---

## Validation Summary

| Check | Result |
|-------|--------|
| No stale mean Δ = 0.034 in canonical | ✅ Only in inventory doc (documenting the problem) |
| No stale 212 metrics in draft or canonical | ✅ Only in inventory doc |
| Phase F v1 / quarantined / invalid not referenced | ✅ Clean |
| All 333 tests referenced | ✅ Line 455 |
| Canonical contains 0.044 and 0.219 | ✅ Lines 305, 309 |
| DR values: 38 handlers not in KE manuscript | ✅ Not referenced (correct — KE does not cite DR implementation details) |
| DR values: 133-bed Makassar hospital correct | ✅ Lines 301, 329 |
| E6 aliasing not presented as current | ✅ No references found |

---

## What Was NOT Changed

- No code changes in KE or DR codebases
- No new experiments executed
- No scientific language hardening applied
- No new claims or evidence added
- §3.1 (P-003 WWII) unchanged
- §3.2 (P-004 Climate) unchanged
- §3.4 (Regional Sentinel Network) unchanged
- §3.5 (Computational Performance) unchanged
- §4.1–§4.3 unchanged
- §4.5 (Generalizability) unchanged
- §5 (Conclusion) unchanged
- References unchanged

---

## Consistency Check

| Value | Canonical §3.3 | Phase F Report | VER-2026-019 | Match |
|-------|----------------|----------------|--------------|-------|
| Mean Δ | 0.044 | 0.044 | 0.044 | ✅ |
| Seed-46 Δ | 0.219 | 0.219 | 0.219 | ✅ |
| Direction consistency | 0.2 | 0.2 | 0.2 | ✅ |
| d | 0.45 | 0.45 | 0.45 | ✅ |
| Extreme-weather events | 41 vs 39 | 41 vs 39 | 41 vs 39 | ✅ |
| First-event ticks | [8,4,6,6,2] | [8,4,6,6,2] | [8,4,6,6,2] | ✅ |
| Metrics count | 199 | 199 | 199 | ✅ |

---

## Final Verdict

**B1 RECONCILIATION: COMPLETE**

The canonical manuscript now accurately reports Phase F values from the Mac execution (VER-2026-019). All stale Windows numbers have been replaced. The three Phase F limitation paragraphs have been added to §4.4. The phase-f-draft.md metric count has been corrected. The untracked (7).md has been fully drained of Phase F content and can be discarded.

No scientific language hardening has been applied. The manuscript remains at the state of the prior canonical version with only Phase F reconciliation changes.
