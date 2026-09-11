/**
 * EXP-001E regression — counterfactual branch isolation.
 *
 * Root cause: makeSnapshot() stored hospitalState by reference and
 * doReconstruct() aliased it, so in-place mutation of nested state
 * (e.g. CSSD trays by cssdHandler) by a parent run contaminated a
 * previously captured rewind point. Branches reconstructed from it then
 * diverged from a fresh branch and were not reproducible.
 *
 * Fix: deep-clone at snapshot capture (makeSnapshot) and at reconstruction
 * (doReconstruct). These tests lock that behaviour in.
 */
import { describe, it, expect } from "vitest";
import { createWorld, run, tick, restoreSnapshot } from "../engine/world-engine.js";
import { createRewindPoint } from "../timeline/index.js";
import { deersRockAdapter } from "./deers-rock-adapter.js";
import { resetUniverseCounter } from "../engine/universe.js";

const DR_ID = "deers-rock-makassar-001";
const SENTINEL = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };
const HORIZON = 20;

function setup(seed = 1003) {
  resetUniverseCounter();
  const dr = deersRockAdapter({ ...SENTINEL }, seed);
  const sectors = [dr];
  const sectorMap = new Map(sectors.map(s => [s.id, s]));
  const world = createWorld(sectors, {}, { seed });
  const rp = createRewindPoint(world, "preseeded", { label: "t0", tags: [] });
  return { world, rp, sectorMap };
}

function trajectory(drState: any): string {
  const inner: any = drState?.world?.state ?? {};
  const beds = inner.beds instanceof Map ? [...inner.beds.values()] : [];
  return JSON.stringify({
    occ: drState?.sentinelOutput?.occupancyRate ?? null,
    enc: inner.encounters?.size ?? null,
    pts: beds.filter((b: any) => b.patientId).length,
    // CSSD tray status/expiry is trajectory (cycleId is a module-global label).
    cssd: (inner._cssd?.trays ?? []).map((t: any) => `${t.status}:${t.expiresAt}`),
  });
}

function runBranch(rp: any, sectorMap: Map<string, any>, horizon = HORIZON): any {
  const snap: any = {
    tick: rp.tick,
    rngState: rp.rngState,
    sectors: Object.entries(rp.sectorStates).map(([id, st]) => ({ id, state: st })),
    universeId: rp.universeId,
    sectorReconstructors: rp.sectorReconstructors,
  };
  let branch = restoreSnapshot(snap, sectorMap);
  let last: any = null;
  for (let t = 1; t <= horizon; t++) {
    branch = tick(branch);
    last = branch.sectors.get(DR_ID)?.state;
  }
  return last;
}

describe("EXP-001E: counterfactual branch isolation", () => {
  it("parent run does not mutate a previously captured rewind point", () => {
    const { world, rp } = setup();
    const hs: any = (rp.sectorStates[DR_ID] as any).hospitalState;
    const before = JSON.stringify(hs._cssd.trays);

    run(world, HORIZON);

    const after = JSON.stringify(hs._cssd.trays);
    expect(after).toBe(before);
  });

  it("a parented branch matches a fresh branch (trajectory isolation)", () => {
    const s1 = setup();
    const fresh = trajectory(runBranch(s1.rp, s1.sectorMap));

    const s2 = setup();
    run(s2.world, HORIZON);
    const parented = trajectory(runBranch(s2.rp, s2.sectorMap));

    expect(parented).toBe(fresh);
  });

  it("two branches from the same rewind point are identical (reproducibility)", () => {
    const s = setup();
    run(s.world, HORIZON);
    const a = trajectory(runBranch(s.rp, s.sectorMap));
    const b = trajectory(runBranch(s.rp, s.sectorMap));
    expect(b).toBe(a);
  });
});
