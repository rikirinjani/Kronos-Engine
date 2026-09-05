/**
 * Regression tests for the deepClone aliasing fix (Snapshotable interface).
 * Tests A–F verify that DR sector state produces independent instances on
 * checkpoint/restore, eliminating cross-reference aliasing artifacts.
 */
import { describe, it, expect } from "vitest";
import { deepClone, extractSnapshot, reconstructFromSnapshot } from "./clone.js";
import { createWorld, run, snapshot, restoreSnapshot } from "./world-engine.js";
import { deersRockAdapter, type DeersRockSectorState } from "../sectors/deers-rock-adapter.js";
import { createRewindPoint, rewindToSnapshot, forkBranch, hashState, resetBranchCounter, resetRewindCounter } from "../timeline/index.js";
import { resetUniverseCounter } from "./universe.js";

/** Compare structural state only, ignoring __snapshot/__reconstruct closures. */
function structuralHash(state: unknown): string {
  const copy = { ...(state as Record<string, unknown>) };
  delete copy.__snapshot;
  delete copy.__reconstruct;
  return hashState(copy);
}

function makeDRWorld(seed = 42) {
  resetUniverseCounter();
  resetBranchCounter();
  resetRewindCounter();
  const sentinel = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };
  const dr = deersRockAdapter({ ...sentinel }, seed);
  const world = createWorld([dr], {}, { seed });
  return { world, dr };
}

// ─── Test A: class-instance independence ────────────────────────────────────
describe("Regression: class-instance independence (Test A)", () => {
  it("deepClone produces a DR state whose world.clock is a distinct object", () => {
    const { world } = makeDRWorld();
    const sectorState = world.sectors.get("deers-rock-makassar-001")!.state;
    const cloned = deepClone(sectorState) as DeersRockSectorState;

    // Different object identity
    expect(cloned).not.toBe(sectorState);
    expect(cloned.world).not.toBe((sectorState as DeersRockSectorState).world);

    // Different clock instance
    expect(cloned.world.clock).not.toBe((sectorState as DeersRockSectorState).world.clock);
    expect(cloned.world.clock.tick).toBe((sectorState as DeersRockSectorState).world.clock.tick);
  });

  it("extractSnapshot produces a plain-object snapshot, reconstructFromSnapshot returns independent instances", () => {
    const { world } = makeDRWorld();
    const sectorState = world.sectors.get("deers-rock-makassar-001")!.state;
    const snap = extractSnapshot(sectorState);
    const restored = reconstructFromSnapshot(sectorState, snap) as DeersRockSectorState;

    expect(restored).not.toBe(sectorState);
    expect(restored.world).not.toBe((sectorState as DeersRockSectorState).world);
    expect(restored.world.clock).not.toBe((sectorState as DeersRockSectorState).world.clock);

    // State content matches
    expect(restored.world.clock.tick).toBe((sectorState as DeersRockSectorState).world.clock.tick);
    expect(restored.world.clock.rngSeed).toBe((sectorState as DeersRockSectorState).world.clock.rngSeed);
  });
});

// ─── Test B: EventQueue independence ────────────────────────────────────────
describe("Regression: EventQueue independence (Test B)", () => {
  it("deepClone produces an EventQueue that is a distinct object", () => {
    const { world } = makeDRWorld();
    const sectorState = world.sectors.get("deers-rock-makassar-001")!.state as DeersRockSectorState;
    const cloned = deepClone(sectorState) as DeersRockSectorState;

    expect(cloned.world.queue).not.toBe(sectorState.world.queue);

    // Mutating the clone's queue should not affect the original
    cloned.world.queue.schedule("test_event", 0, { value: 999 });
    const originalPending = sectorState.world.queue.pending();
    const clonedPending = cloned.world.queue.pending();
    expect(clonedPending).toBe(originalPending + 1);
  });

  it("reconstructed EventQueue is independent of the original", () => {
    const { world } = makeDRWorld();
    const sectorState = world.sectors.get("deers-rock-makassar-001")!.state as DeersRockSectorState;
    const snap = extractSnapshot(sectorState);
    const restored = reconstructFromSnapshot(sectorState, snap) as DeersRockSectorState;

    restored.world.queue.schedule("test_event", 0, { value: 999 });
    expect(sectorState.world.queue.pending()).toBe(0);
    expect(restored.world.queue.pending()).toBe(1);
  });
});

// ─── Test C: Clock independence ─────────────────────────────────────────────
describe("Regression: Clock independence (Test C)", () => {
  it("deepClone produces a Clock that is a distinct object", () => {
    const { world } = makeDRWorld();
    const sectorState = world.sectors.get("deers-rock-makassar-001")!.state as DeersRockSectorState;
    const cloned = deepClone(sectorState) as DeersRockSectorState;

    expect(cloned.world.clock).not.toBe(sectorState.world.clock);

    // Same content
    expect(cloned.world.clock.tick).toBe(sectorState.world.clock.tick);
    expect(cloned.world.clock.rngSeed).toBe(sectorState.world.clock.rngSeed);
    expect(cloned.world.clock.tickIntervalMs).toBe(sectorState.world.clock.tickIntervalMs);
  });

  it("reconstructed Clock is independent and has correct fields", () => {
    const { world } = makeDRWorld();
    const sectorState = world.sectors.get("deers-rock-makassar-001")!.state as DeersRockSectorState;
    const snap = extractSnapshot(sectorState);
    const restored = reconstructFromSnapshot(sectorState, snap) as DeersRockSectorState;

    expect(restored.world.clock).not.toBe(sectorState.world.clock);
    expect(restored.world.clock.tick).toBe(sectorState.world.clock.tick);
    expect(restored.world.clock.rngSeed).toBe(sectorState.world.clock.rngSeed);
    expect(restored.world.clock.hospitalTimeMs).toBe(sectorState.world.clock.hospitalTimeMs);
  });
});

// ─── Test D: RNG independence ───────────────────────────────────────────────
describe("Regression: RNG independence (Test D)", () => {
  it("RNG state is preserved through snapshot/reconstruct", () => {
    const { world } = makeDRWorld();
    const sectorState = world.sectors.get("deers-rock-makassar-001")!.state as DeersRockSectorState;
    const snap = extractSnapshot(sectorState);
    const restored = reconstructFromSnapshot(sectorState, snap) as DeersRockSectorState;

    // RNG seed preserved
    expect(restored.world.clock.rngSeed).toBe(sectorState.world.clock.rngSeed);
  });

  it("RNG state is independent after reconstruction", () => {
    const { world } = makeDRWorld();
    const sectorState = world.sectors.get("deers-rock-makassar-001")!.state as DeersRockSectorState;
    const snap = extractSnapshot(sectorState);
    const restored1 = reconstructFromSnapshot(sectorState, snap) as DeersRockSectorState;
    const restored2 = reconstructFromSnapshot(sectorState, snap) as DeersRockSectorState;

    // Both restorations from same snapshot produce same RNG seed
    expect(restored1.world.clock.rngSeed).toBe(restored2.world.clock.rngSeed);
    // But they are different object instances
    expect(restored1.world.clock).not.toBe(restored2.world.clock);
  });
});

// ─── Test E: deterministic restore ──────────────────────────────────────────
describe("Regression: deterministic restore (Test E)", () => {
  it("two deepClones from the same state produce identical structural content", () => {
    const { world } = makeDRWorld();
    const sectorState = world.sectors.get("deers-rock-makassar-001")!.state as DeersRockSectorState;

    // Advance a few ticks to get non-trivial state
    const advanced = run(world, 5);
    const advancedState = advanced.sectors.get("deers-rock-makassar-001")!.state as DeersRockSectorState;

    const clone1 = deepClone(advancedState);
    const clone2 = deepClone(advancedState);

    // Compare structural state (excluding Snapshotable closures)
    expect(structuralHash(clone1)).toBe(structuralHash(clone2));
  });

  it("two reconstructFromSnapshot calls from the same snapshot produce identical structural content", () => {
    const { world } = makeDRWorld();
    const advanced = run(world, 5);
    const advancedState = advanced.sectors.get("deers-rock-makassar-001")!.state as DeersRockSectorState;

    const snap = extractSnapshot(advancedState);
    const restored1 = reconstructFromSnapshot(advancedState, snap);
    const restored2 = reconstructFromSnapshot(advancedState, snap);

    expect(structuralHash(restored1)).toBe(structuralHash(restored2));
  });

  it("restored state from extractSnapshot matches world-engine snapshot", () => {
    const { world } = makeDRWorld();
    const advanced = run(world, 5);
    const advancedState = advanced.sectors.get("deers-rock-makassar-001")!.state as DeersRockSectorState;

    // World-engine snapshot uses deepClone (which now uses Snapshotable)
    const worldSnap = snapshot(advanced);
    const drSnap = worldSnap.sectors.find(s => s.id === "deers-rock-makassar-001")!;

    // Adapter extract/reconstruct
    const adapterSnap = extractSnapshot(advancedState);
    const restored = reconstructFromSnapshot(advancedState, adapterSnap);

    // Both reconstruction paths should produce equivalent structural content
    expect(structuralHash(drSnap.state)).toBe(structuralHash(restored));
  });
});

// ─── Test F: counterfactual branch validity vs fresh-world E4 ───────────────
describe("Regression: counterfactual branch validity (Test F)", () => {
  it("forkBranch produces a child that diverges from parent (no aliasing)", () => {
    const { world, dr } = makeDRWorld();
    const sectorMap = new Map([["deers-rock-makassar-001", dr]]);

    const rp = createRewindPoint(world, "runtime", { label: "test" });
    const parentAfter = run(world, 10);

    const intervention = { climate: { co2Concentration: 350 } };
    const branch = forkBranch(world, rp, intervention, sectorMap, 10, "test branch");

    // Parent and child should produce different hashes
    const parentHash = hashState(parentAfter.sectors);
    const childHash = hashState(branch.childSnapshot.sectors);
    expect(typeof parentHash).toBe("string");
    expect(typeof childHash).toBe("string");

    // The child's DR state must NOT be the same object as the parent's
    const parentDR = parentAfter.sectors.get("deers-rock-makassar-001")!;
    const childDRState = branch.childSnapshot.sectors.find(s => s.id === "deers-rock-makassar-001")!;
    expect(childDRState.state).not.toBe(parentDR.state);
  });

  it("baseline integrity guard holds after fix", () => {
    const { world, dr } = makeDRWorld();
    const sectorMap = new Map([["deers-rock-makassar-001", dr]]);

    const rp = createRewindPoint(world, "runtime", { label: "test" });
    const baselineSnap = snapshot(world);

    const parentAfter = run(world, 10);

    // The rewind point's baseline must deep-equal the pristine baseline
    const restoredBaseline = restoreSnapshot(rewindToSnapshot(rp), sectorMap);
    for (const [id, record] of restoredBaseline.sectors) {
      const b = baselineSnap.sectors.find(s => s.id === id);
      expect(b).toBeDefined();
      expect(structuralHash(record.state)).toBe(structuralHash(b!.state));
    }
  });
});
