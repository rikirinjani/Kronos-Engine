# KE Manuscript — JAMIA Pre-Submission Audit

**Manuscript:** `docs/papers/jamia-2026-kronos-engine.md`
**Date:** 2026-09-10
**Companion:** `../../docs/jamia-2026-joint-submission-audit.md` (workspace joint report)
**Verdict:** MAJOR REVISION REQUIRED

---

## 1. Article-Type Fit

**Research and Applications.** Abstract headings already match JAMIA R&A (Objective / Materials and Methods / Results / Discussion / Conclusion).

| Constraint | Limit | Actual | Status |
|---|---|---|---|
| Main text words (excl. ack./refs) | 4,000 | **≈5,802** | ❌ over by ~1,800 |
| Abstract words | 250 | **≈523** | ❌ over |
| Tables | 4 | ≤4 | ✅ |
| Figures | 6 | 3 (unrendered) | ⚠️ |
| Keywords | 5 | 6 | ⚠️ trim |
| References | unlimited | 16 | ✅ |

## 2. Scientific Audit

- Claims scoped to architecture/methods; causal language confined to traceability (§2.6, §3.1 explicitly deny real-world causal inference). ✅
- Phase F presented as a diagnostic null of the implemented model, not a failed clinical experiment. ✅
- Limitations comprehensive (§4.4): no empirical validation, P-004 non-reproducibility, single simulator, short duration, sector fidelity, multiplicity, GDP effect size, saturation, admission quantization, discharge delay, isolation. ✅
- **Canonical evidence corrected:** §3.3 previously reported Windows values (`Δ = 0.17`, `mean Δ = 0.034`); corrected to Mac canonical (`Δ = 0.219`, `mean Δ = 0.044`, VER-2026-019) with the ≥80% criterion-not-met made explicit. Table `+0.034 → +0.044`. ✅
- Windows/Linux/Vultr results not represented as canonical. ✅
- Vultr admission-threshold experiment correctly **not** included. ✅

## 3. Numerical Audit

- seed-46 Δ = 0.219 ✅ (corrected); mean Δ = 0.044 ✅ (corrected); direction consistency 1/5 ✅; 333/333 regression ✅; adapter `floor(floor(rng×3)×1.3)` ✅.
- **DR bed count = "133-bed" (lines 129, 283, 301)** — the current DR implementation defaults to **131 beds**, and the adapter's `beds: 133` config is unused by `createWorld`. **FLAG — unresolved** (also contradicts DR paper's 55).
- P-003/P-004 numbers internally consistent with the evidence matrix.

## 4. Figure/Table Audit

- Figure 1 ("about here"), Figure 2 ("about here"), Figure 3 ("Required Figures") — **all unrendered placeholders**.
- Figure 2 caption ("GDP null result") consistent with §3.1.
- Tables corrected (SupplyStress +0.044).

## 5. Reference Audit

- [1]–[16] resolve; Medline style. ✅
- §4.3 co-simulation paragraph cites FMI/FMU and HLA **without references** — add or remove.

## 6. Reproducibility / Data Availability

- Supplementary: "Available upon request (repository not yet public)" — weak/inconsistent with DR's public repo; JAMIA requires a Data Availability Statement.
- Canonical Phase F requires macOS 26.6.2 arm64 / Node v26.5.0.
- Recommended statement: see joint report §12.

## 7. Submission Metadata

| Item | Status |
|---|---|
| Authors | ⚠️ "R. Kirinjani, et al." incomplete |
| Affiliation | ⚠️ "Independent Research" |
| Corresponding author / email / ORCID | ❌ missing |
| Keywords ≤5 | ⚠️ 6 |
| Funding / COI / Acknowledgements | ❌ missing |
| Data availability | ❌ missing |
| AI disclosure | ❌ missing |
| Ethics statement | ❌ missing |
| Related-manuscript disclosure | ❌ missing |

**AUTHOR ACTION REQUIRED.**

## 8. Required Edits

**Applied:** Phase F values (0.219/0.044) + table.
**Required:** condense to ≤4,000 words; trim abstract to ≤250; trim keywords to 5; add AI disclosure, Data Availability, ethics statement; add FMI/HLA citations; resolve bed count; render figures; disclose companion manuscript.

## 9. Reviewer Attack Test

1. "Just software integration" — answered (§4.1/§4.3). MINOR.
2. "Canonical Phase F numbers were wrong" — **fixed by this audit**. Resolved.
3. "Exceeds JAMIA limits" — **not answered**. MAJOR.
4. "Bed count contradicts the companion paper" — **not answered**. MAJOR.
5. "Uncited co-simulation comparison" — not answered. MINOR.

## 10. Verdict

**MAJOR REVISION REQUIRED** — canonical-evidence error corrected; word/abstract overages and missing submission elements remain.
