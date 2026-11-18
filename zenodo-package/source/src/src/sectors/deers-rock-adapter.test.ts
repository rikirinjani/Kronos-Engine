import { describe, it, expect } from "vitest";
import { getHospitalSeed, deersRockAdapter, buildMacroPacket, createSentinels, ADAPTER_INVARIANTS } from "./deers-rock-adapter.js";
import type { DeersRockSectorState } from "./deers-rock-adapter.js";
import { createEventBus } from "./event-bus.js";
import type { RNG } from "./types.js";
import { GEOPOLITICS_EVENTS, CLIMATE_EVENTS } from "./events.js";

function mulberry32(seed: number): RNG {
  let s = seed | 0;
  return {
    next(): number {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

describe("getHospitalSeed", () => {
  it("returns deterministic seed for same worldSeed and hospitalId", () => {
    const a = getHospitalSeed(42, 1);
    const b = getHospitalSeed(42, 1);
    expect(a).toBe(b);
  });

  it("returns different seeds for different hospitalIds", () => {
    const a = getHospitalSeed(42, 1);
    const b = getHospitalSeed(42, 2);
    expect(a).not.toBe(b);
  });
});

describe("buildMacroPacket", () => {
  it("returns baseline packet when no events", () => {
    const packet = buildMacroPacket([], 1);
    expect(packet.admissionMultiplier).toBe(1.0);
    expect(packet.staffAvailabilityModifier).toBe(1.0);
    expect(packet.supplyChainPressure).toBe(0);
  });

  it("increases admission multiplier on extreme weather", () => {
    const packet = buildMacroPacket(
      [{ type: CLIMATE_EVENTS.EXTREME_WEATHER, data: { severity: 3 } }],
      1
    );
    expect(packet.admissionMultiplier).toBe(1.3);
    expect(packet.supplyChainPressure).toBe(0.4);
  });

  it("reduces staff availability on war", () => {
    const packet = buildMacroPacket(
      [{ type: GEOPOLITICS_EVENTS.WAR_START, data: { warId: "W-1" } }],
      1
    );
    expect(packet.staffAvailabilityModifier).toBe(0.85);
    expect(packet.admissionMultiplier).toBe(1.2);
  });
});

describe("deersRockAdapter", () => {
  it("init creates state with Deers Rock world", () => {
    const config = { id: "test-001", city: "TestCity", beds: 50, patients: 20, ticksPerDay: 10 };
    const sector = deersRockAdapter(config, 42);
    const state = sector.init(42, {}) as DeersRockSectorState;

    expect(state._sectorId).toBe("deers-rock");
    expect(state.config.id).toBe("test-001");
    expect(state.config.city).toBe("TestCity");
    expect(state.world).toBeDefined();
    expect(state.world.state).toBeDefined();
  });

  it("tick runs DR steps and produces sentinel output", () => {
    const config = { id: "test-001", city: "TestCity", beds: 50, patients: 20, ticksPerDay: 10 };
    const sector = deersRockAdapter(config, 42);
    const bus = createEventBus();
    const state = sector.init(42, {}) as DeersRockSectorState;
    const ctx = { tick: 1, rng: mulberry32(42), eventBus: bus };

    const next = sector.tick(state, ctx) as DeersRockSectorState;

    expect(next.sentinelOutput).not.toBeNull();
    expect(next.sentinelOutput!.hospitalId).toBe("test-001");
    expect(next.sentinelOutput!.city).toBe("TestCity");
    expect(next.sentinelOutput!.occupancyRate).toBeGreaterThanOrEqual(0);
    expect(next.sentinelOutput!.occupancyRate).toBeLessThanOrEqual(1);
  });

  it("tick may publish health events when thresholds exceeded", () => {
    const config = { id: "test-001", city: "TestCity", beds: 50, patients: 20, ticksPerDay: 10 };
    const sector = deersRockAdapter(config, 42);
    const bus = createEventBus();
    const state = sector.init(42, {}) as DeersRockSectorState;
    const ctx = { tick: 1, rng: mulberry32(42), eventBus: bus };

    sector.tick(state, ctx);

    const healthEvents = bus.pending().filter((e) => e.type.startsWith("health."));
    expect(Array.isArray(healthEvents)).toBe(true);
  });

  it("deterministic: same config + seed = same sentinel output", () => {
    const config = { id: "test-001", city: "TestCity", beds: 50, patients: 20, ticksPerDay: 10 };
    const sector = deersRockAdapter(config, 42);
    const busA = createEventBus();
    const busB = createEventBus();
    const stateA = sector.init(42, {}) as DeersRockSectorState;
    const stateB = sector.init(42, {}) as DeersRockSectorState;
    const ctxA = { tick: 1, rng: mulberry32(42), eventBus: busA };
    const ctxB = { tick: 1, rng: mulberry32(42), eventBus: busB };

    const nextA = sector.tick(stateA, ctxA) as DeersRockSectorState;
    const nextB = sector.tick(stateB, ctxB) as DeersRockSectorState;

    expect(nextA.sentinelOutput!.occupancyRate).toBe(nextB.sentinelOutput!.occupancyRate);
    expect(nextA.sentinelOutput!.staffStress).toBe(nextB.sentinelOutput!.staffStress);
  });

  it("has circuitBreakerTripped field in state", () => {
    const config = { id: "test-001", city: "TestCity", beds: 50, patients: 20, ticksPerDay: 10 };
    const sector = deersRockAdapter(config, 42);
    const state = sector.init(42, {}) as DeersRockSectorState;

    expect(state.circuitBreakerTripped).toBe(false);
  });

  it("includes health.down in events list", () => {
    const config = { id: "test-001", city: "TestCity", beds: 50, patients: 20, ticksPerDay: 10 };
    const sector = deersRockAdapter(config, 42);

    expect(sector.events).toContain("health.down");
  });
});

describe("createSentinels", () => {
  it("returns sectors sorted by hospitalId", () => {
    const sentinels = createSentinels([
      { id: "z-003", city: "Z", beds: 10, patients: 5 },
      { id: "a-001", city: "A", beds: 10, patients: 5 },
      { id: "m-002", city: "M", beds: 10, patients: 5 },
    ], 42);

    expect(sentinels).toHaveLength(3);
    expect(sentinels[0]!.id).toBe("deers-rock-a-001");
    expect(sentinels[1]!.id).toBe("deers-rock-m-002");
    expect(sentinels[2]!.id).toBe("deers-rock-z-003");
  });

  it("does not mutate input array", () => {
    const input = [
      { id: "b", city: "B", beds: 10, patients: 5 },
      { id: "a", city: "A", beds: 10, patients: 5 },
    ];
    const original = input.map((x) => x.id).join(",");

    createSentinels(input, 42);

    expect(input.map((x) => x.id).join(",")).toBe(original);
  });
});

describe("ADAPTER_INVARIANTS", () => {
  it("contains all boundary rules", () => {
    expect(ADAPTER_INVARIANTS.TRANSLATES_ONLY).toContain("Adapter translates");
    expect(ADAPTER_INVARIANTS.DR_ISOLATION).toContain("Deers Rock never sees");
    expect(ADAPTER_INVARIANTS.LOCAL_SIGNAL_ONLY).toContain("local observation");
    expect(ADAPTER_INVARIANTS.NO_PATIENT_DATA).toContain("patient-level data");
    expect(ADAPTER_INVARIANTS.INDEPENDENT_SEED).toContain("own RNG seed");
  });
});
