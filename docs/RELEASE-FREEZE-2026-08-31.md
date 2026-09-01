# Kronos Engine — Research Release Freeze (2026-08-31)

**Status:** RELEASE CANDIDATE — frozen substrate for Phase 2 (Deers Rock RNG) and Phase 3 (paper reconstruction).
**Freeze date:** 2026-08-31
**Freeze authority:** Final Reopening Execution Task (Phase 1), verifier-approved remediation.

---

## 1. Repository state at freeze

| Item | Value |
|------|-------|
| Branch | `master` |
| HEAD commit | `19b3bb494aec7f8fda1ecca11ec179999f77300a` |
| Baseline tag | `baseline-pre-reopen` → `907c859fbaa96f688848a5e1b10dc6aacb60122a` |
| Remediation SHA range | `6b397fc` … `698146f` (7 commits, fast-forward merged) |
| Audit evidence commit | `19b3bb4` (REOPEN-AUDIT-2026-08-31, NCR-003/004/005/006, VER-002/003/004) |
| Working tree | clean (0 uncommitted lines) |
| Remote | `origin/master` exists; **not pushed** (push requires human approval) |

## 2. Provenance chain

```
907c859 (baseline-pre-reopen tag — pre-remediation HEAD)
   ↓ reopening audit (REOPEN-AUDIT-2026-08-31.md, NCR-003/004/005/006, VER-002/003/004)
6b397fc remediation: integrity, CI gate, stats, counterfactual guards
1e36cbd remediation: regenerate experiment artifacts with corrected engine + stats
f9bb0b7 remediation: sentinel feedback claim descoped to verified reality
cfdeebf reproducibility: one-command reproduction path (5/5 gates)
d436fd0 release: v1.0.0 metadata (MIT LICENSE, CITATION.cff, .zenodo.json, RELEASE-CHECKLIST)
5b59c73 remediation: reconcile paper numerical claims with corrected artifacts
698146f test: raise heatwave integration timeout (60s)
19b3bb4 audit: preserve reopening audit evidence
```

No historical commits rewritten. Baseline remains recoverable via tag.

## 3. Verification evidence (frozen)

| Gate | Result |
|------|--------|
| `npx vitest run` | 34 files / 307 tests passed, exit 0 |
| `npx tsc --noEmit` | clean, exit 0 |
| `npx tsx scripts/verify-facts.ts` | 13/13 checks, exit 0 |
| `npx tsx scripts/reproduce.ts` | 5/5 deterministic gates, exit 0 |
| Tree after reproduction | clean (0 lines) |

Environment: Node `v22.23.2`, npm `10.9.8` (package.json `engines.node >= 22`).

## 4. Corrected experiment results (frozen)

### P-003 ("No WWII", 30 seeds, reproducible)
- 1,233 metrics; 19 significant uncorrected; **1 BH-FDR survivor; 1 Bonferroni survivor; 0 GDP survivors**
- Surviving metric: `wars.W-1939-01.casualties` (d=−1.46, q≈2.4e-6) — **mechanically tied to the intervention** (ending a war stops its casualties). Must NOT be presented as validation of GDP or general causal validity.
- Framing: exploratory **negative** result demonstrating the reproducible counterfactual pipeline.

### P-004 (climate→hospital, 30 seeds) — NOT yet reproducible
- 212 metrics; 14 significant uncorrected; 0 Bonferroni survivors.
- **Blocking issue:** Deers Rock (external repo) uses unseeded `Math.random`/`Date.now()` in its dist bundle → run-to-run nondeterminism. Parallel DR-side audit (VER-2026-004, NCR-2026-006) additionally found: macro→micro adapter **inert** (events dropped by DR `world.ts` switch; 3/5 packet fields never read), micro→macro channel **dead** (zero `health.*` subscribers), committed P-004 (156/14) regenerates as 515/42 fresh.
- **Phase 2 target:** resolve DR RNG determinism + adapter consumption path before claiming P-004 reproducibility.

## 5. Known remaining limitations (frozen, not resolved)

1. **Deers Rock RNG nondeterminism** — external repo; Phase 2 target. Do not claim P-004 reproducibility until resolved.
2. **Macro→micro adapter inert** — DR `world.ts` drops `admission_surge`/`staff_shortage`; 3/5 `MacroConditionPacket` fields never read (DR-side audit finding).
3. **Micro→macro channel dead** — zero `health.*` subscribers in KE (documented in paper; descoped claim).
4. **PROJECT-OVERVIEW.md** still asserts bidirectional sentinel integration — needs reconciliation (Phase 3).
5. **Historical paper drafts v1–v4** retain pre-correction claims — superseded snapshots; archival decision pending.
6. **Deers Rock seeding** of its own RNG not yet implemented (Phase 2).

## 6. Freeze discipline

- No unrelated feature changes after this freeze.
- Phase 2 (DR RNG + P-004 reproducibility) proceeds on this substrate.
- Phase 3 (paper reconstruction) begins only after Phase 2 passes.
- Any methodology change must be documented (old → reason → new → comparability effect).