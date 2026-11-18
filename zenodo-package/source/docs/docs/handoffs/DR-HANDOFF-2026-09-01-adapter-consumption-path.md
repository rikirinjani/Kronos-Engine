# DR HANDOFF — Deers Rock Adapter Consumption Path (Option A)

**From:** Kronos Engine (KE) Reopening Agent
**To:** Deers Rock (DR) Agent
**Date:** 2026-09-01
**Provenance:** Kronos Engine Final Reopening Execution Task — Phase 2 (Deers Rock RNG + full P-004 reproducibility). Phase 2 was BLOCKED at the human authorization boundary. Human authorization has now selected **Option A (real fix)** on the explicit condition that DR-side work is executed by the DR agent inside the DR repository.
**KE-side blocker record:** `Kronos Engine/docs/PHASE2-BLOCKER-2026-09-01.md` (commit `ae6f480`, KE master)

---

## 1. Context

Kronos Engine is a deterministic multi-sector world simulator (TypeScript, Node 22). It wraps Deers Rock (a hospital operations simulator) as a "sentinel" sector through `src/sectors/deers-rock-adapter.ts`. The sentinel pattern is one-directional by design:

```text
KE world events → adapter → MacroConditionPacket → DR   (macro→micro)
DR state → adapter → HospitalSentinelOutput → KE        (micro→macro observation)
```

The invariant that must be preserved:

> The world does not reach into the hospital. It knocks on the adapter's door and waits for the signal.

A 2026-08-31 reopening audit on both repos established that the **macro→micro channel is dead**: the KE intervention never changes DR behavior, because DR drops the macro packet's events. P-004 (the KE counterfactual experiment targeting the DR sentinel) therefore cannot demonstrate macro→micro coupling.

**Already ruled out — do not re-investigate:**

- DR RNG is **already deterministic**: mulberry32, seeded; cross-process runs with identical seeds are byte-identical (KE probe, seeds 42 and 7, 200 ticks). Wall-clock does not enter simulation state when seeded.
- KE-side reproducibility: tests 34 files/307 pass, `tsc` clean, `verify-facts` 13/13, `reproduce` 5/5, clean tree.
- P-004 was rerun against the fresh deterministic DR dist: 30 seeds, 199 metrics, 6 significant uncorrected, 0 BH-FDR, 0 Bonferroni, **0 DR-specific significant**. All 6 survivors are macro-sector tiny-variance artifacts. DR primary outcomes (cssd Δ=0, dialysis Δ=+4.0, occupancy Δ=+0.03) are rewind/restore artifacts, not intervention effects.

---

## 2. Established evidence (exact locations)

### 2.1 KE adapter already schedules the events

`Kronos Engine/src/sectors/deers-rock-adapter.ts` (lines 17–24, 206, 209):

```ts
export interface MacroConditionPacket {
  tick: number;
  admissionMultiplier: number;
  diagnosisWeightOverrides: Record<string, number>;
  supplyChainPressure: number;
  staffAvailabilityModifier: number;
  activeDisasterType?: string;
}
```

```ts
world.queue.schedule("admission_surge", 0, { multiplier: macroPacket.admissionMultiplier });
world.queue.schedule("staff_shortage", 0, { modifier: macroPacket.staffAvailabilityModifier });
```

Only **2 of 5** macro fields are scheduled into DR's queue (`admissionMultiplier`, `staffAvailabilityModifier`). The other 3 (`diagnosisWeightOverrides`, `supplyChainPressure`, `activeDisasterType`) are never scheduled at all.

### 2.2 DR drops the scheduled events

`Deers-Rock/src/engine/world.ts` (lines 249–267):

```ts
export function step(world: World): World {
  ...
  const scheduledDischarges = dueEvents.filter(e => e.type === "discharge")...
  state = dischargeScheduledPatients(state, newClock, scheduledDischarges);

  for (const evt of dueEvents) {
    switch (evt.type) {
      case "lab_result": ...
      case "rad_result": ...
      case "ed_discharge": ...
      case "surgery_done": ...
    }
  }
  ...
}
```

There is **no case for `admission_surge` or `staff_shortage`** and no default handler — both events are dequeued and silently ignored. Result:

```text
KE intervention → emissions_control → climate events → macro condition packet
    → adapter schedules admission_surge / staff_shortage into DR queue
    → [ DEAD CHANNEL — DR step() switch drops both ]
    → DR state unchanged
```

### 2.3 Consequence

P-004 cannot demonstrate macro→micro coupling regardless of RNG determinism. The blocker was recorded under KE governance rule 11 and Phase 2 §6 ("stop and document the blocker rather than weakening the reproducibility claim").

---

## 3. Work request (Deers-Rock repository)

All items below are **Deers-Rock repo changes**. Do not modify Kronos Engine.

### R1 — `admission_surge` handler in DR's event dispatch

- Add a case for `admission_surge` in the `step()` dispatch (or an equivalent handler registered in `world.handlers`, whichever matches DR's architecture — your choice; document the decision).
- Event payload from the adapter: `{ multiplier: number }` (relative multiplier on admissions for that tick).
- Define and implement DR-side semantics (e.g., scale incoming admissions/arrivals for that tick by `multiplier`). Use DR's own domain logic; do not invent semantics that require KE concepts (GDP, wars, global temperature).
- Must be deterministic: any randomness inside the handler must come from DR's seeded clock RNG — never `Math.random`, `Date.now`, or unseeded crypto.

### R2 — `staff_shortage` handler

- Add a case for `staff_shortage`. Payload: `{ modifier: number }` (staff availability modifier for that tick).
- Define and implement DR-side semantics (e.g., scale effective staff capacity/throughput for that tick), consistent with DR's existing staffing model.
- Same determinism requirements as R1.

### R3 — Wire the 3 unscheduled packet fields (or formally descope them)

Current state: `diagnosisWeightOverrides`, `supplyChainPressure`, `activeDisasterType` are never delivered into DR. For each field choose:

- **(a) Implement consumption:** extend the adapter→DR delivery surface with a documented mechanism and implement DR-side semantics; **or**
- **(b) Formally descope:** record in DR documentation (and in your handoff-ledger reply) that the field is intentionally unused at this integration depth.

Silent dropping is not acceptable — every field must be either consumed or explicitly descoped. Note: extending the delivery surface requires a matching KE adapter change; if you choose (a) for any field, specify the exact delivery contract you need (function signature, packet fields, event types) in your reply, and KE will implement the adapter side.

### R4 — Seed interface decision (document it)

KE reference formula: `worldSeed ^ (hospitalId * 2654435761) >>> 0` (hospitalId currently derived from the sentinel's string ID via a djb2-style hash). DR already receives a derived seed from the KE adapter and its mulberry32 stream is verified deterministic. For this work item: **do not blindly copy the KE formula** — if DR's architecture benefits from a cleaner deterministic seed interface (e.g., explicit `seed` parameter threaded through `createWorld`/`createClock` with no `Date.now()` fallback when a seed is supplied), implement and document that instead. The requirement is: seed derived deterministically from world/sentinel identity; independent sentinels remain independent; no wall-clock dependence. Record the decision and rationale in DR docs.

---

### R5 — Determinism probes/tests (Phase 2 §3 of the KE execution task)

Add DR-side tests/probes demonstrating:

1. **Same seed:** same initial state + same event sequence → identical final state, identical exported metrics, identical relevant serialized representation across repeated executions (cross-process if practical).
2. **Different seeds:** different seeds produce different trajectories where stochastic behavior exists.
3. **Sentinel independence:** one sentinel's RNG stream does not perturb another sentinel's output.
4. **Replay:** restoring/replaying a deterministic run reproduces the same relevant output.
5. **No wall-clock dependence:** execution timing does not alter simulation results (e.g., run with seeded clock twice at different real times → identical output).

### R6 — Rebuild `dist`

After source changes, rebuild the DR distribution and report the build timestamp. KE consumes DR via `dist/index.js`; a stale dist was itself a source of the original P-004 nondeterminism artifact (documented in the DR-side audit `reopen-audit/05-statistical-reassessment.md`).

---

## 4. Boundary constraints (must hold after your changes)

1. **Kronos invariant preserved:** the hospital must not directly consume macro-sector state; DR consumes only what arrives through its own event queue / delivery surface. DR must not import anything from Kronos Engine.
2. **Keep the adapter invariants intact** (from `deers-rock-adapter.ts`, `ADAPTER_INVARIANTS`): TRANSLATES_ONLY, DR_ISOLATION, LOCAL_SIGNAL_ONLY, NO_PATIENT_DATA, INDEPENDENT_SEED. In particular: no patient-level data may leak upward, and sentinel output stays a local observation.
3. **Determinism:** no uncontrolled stochastic sources enter simulation state (no unseeded `Math.random`, `Date.now`, UUID-v4, or crypto randomness in sim logic).
4. **Independent sentinels:** two sentinel instances (same or different seeds) must not share RNG state or otherwise perturb each other.
5. **Respect existing DR architecture:** implement handlers in the way DR's own patterns dictate; do not restructure the engine to accommodate KE.

## 5. What KE will do after DR delivers

1. Fix the KE-side P-004 worldSeed hardcoding (`src/experiment/experiments/dr-counterfactual.ts:113` currently hardcodes `42`) to derive a per-seed DR world seed — this is KE-side and requires no DR action.
2. Re-run the full P-004 experiment (30 seeds, original intervention, matched-horizon and baseline-integrity guards) against your rebuilt `dist`.
3. Recalculate statistics with the corrected pipeline (effect estimates, p-values, BH-FDR, Bonferroni, CI, Cohen's d, degenerate-case guards). Complete outcome reported — no metric selection.
4. Run the Phase 2 reproducibility gate: P-004 executes; repeated execution reproduces the same results; DR RNG demonstrably deterministic; adapter boundary intact; no hidden stochastic source; statistical outputs reproducible; repository tree clean after reproduction.

## 6. Acceptance checklist (KE will verify before rerunning P-004)

- [ ] `admission_surge` event changes DR state (demonstrable in a test: state differs with/without event, same seed)
- [ ] `staff_shortage` event changes DR state (same test pattern)
- [ ] Every `MacroConditionPacket` field is consumed or explicitly descoped (documented)
- [ ] New handlers are deterministic under the seeded clock (probe: repeated runs byte-identical)
- [ ] Different seeds still diverge; sentinel independence still holds (existing + new probes green)
- [ ] No wall-clock dependence introduced
- [ ] DR test suite green; `dist` rebuilt and timestamp reported
- [ ] DR docs updated (handler semantics, seed interface decision, any descopes)
- [ ] Reply posted to your handoff ledger with: decisions taken, files changed, `dist` build timestamp, and any contract changes KE must implement (per R3a)

## 7. Governance and references

- Preserve negative results and audit evidence; do not rewrite history in either repo.
- If a methodology change becomes necessary (event semantics differ from what KE assumed), document `old methodology / reason for change / new methodology / effect on comparability` in your reply — KE will carry it into the P-004 report.
- References:
  - KE blocker record: `Kronos Engine/docs/PHASE2-BLOCKER-2026-09-01.md`
  - KE reopening audit: `Kronos Engine/docs/audits/REOPEN-AUDIT-2026-08-31.md`
  - DR-side reopening audit: `Deers-Rock/reopen-audit/` (01-executive-summary, 03-boundary-compliance-matrix, 05-statistical-reassessment, README-REPRODUCIBILITY)
  - QMS: NCR-2026-006 / VER-2026-004 (DR reopen audit), NCR-2026-003/004/005 (KE)
  - KE release freeze: `Kronos Engine/docs/RELEASE-FREEZE-2026-08-31.md` (frozen at `bc68796`; baseline tag `baseline-pre-reopen`)

## 8. Do NOT

- Do not modify Kronos Engine, its adapter, or its experiment code (KE agent owns that lane).
- Do not weaken or bypass the reproducibility/determinism requirements to make integration easier.
- Do not invent authorship/metadata or alter historical evidence in either repo.
- Do not change P-004's intervention, baseline, seed count, tick count, statistical methodology, or metric extraction rules from the KE side (KE owns those; flag any incompatibility instead).

---

**Reply protocol:** post your completion summary (decisions, files changed, dist timestamp, contract requests for R3a) to the DR handoff ledger. KE's reopening agent will pick it up and resume Phase 2 from the P-004 rerun step.
