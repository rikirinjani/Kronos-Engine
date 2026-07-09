import { describe, it, expect, beforeEach } from "vitest";
import { tick, run, createWorld, snapshot, restoreSnapshot } from "./world-engine.js";
import { resetUniverseCounter } from "./universe.js";
import type { Sector, SectorState, WorldContext } from "../sectors/types.js";

function makeSector(id: string, cadence: number, tickCounter?: { called: number }): Sector {
  const counter = tickCounter ?? { called: 0 };
  return {
    id,
    name: id,
    cadence,
    events: [],
    handlers: [],
    init(): SectorState {
      return { _sectorId: id };
    },
    tick(state: SectorState, _ctx: WorldContext): SectorState {
      counter.called++;
      return { ...state, _lastTick: _ctx.tick } as SectorState;
    },
  };
}

beforeEach(() => {
  resetUniverseCounter();
});

describe("Cadenced Tick Pipeline", () => {
  it("cadence 1 sector ticks every world tick", () => {
    const counter = { called: 0 };
    const sector = makeSector("test", 1, counter);
    let world = createWorld([sector], {});

    world = run(world, 5);
    expect(counter.called).toBe(5);
  });

  it("cadence 3 sector ticks every 3rd tick", () => {
    const counter = { called: 0 };
    const sector = makeSector("test", 3, counter);
    let world = createWorld([sector], {});

    world = run(world, 10);
    expect(counter.called).toBe(3);
  });

  it("cadence 10 sector ticks once in 10 ticks", () => {
    const counter = { called: 0 };
    const sector = makeSector("test", 10, counter);
    let world = createWorld([sector], {});

    world = run(world, 10);
    expect(counter.called).toBe(1);
  });

  it("multiple sectors with different cadences", () => {
    const c1 = { called: 0 };
    const c3 = { called: 0 };
    const c5 = { called: 0 };
    const sectors = [
      makeSector("daily", 1, c1),
      makeSector("triple", 3, c3),
      makeSector("quint", 5, c5),
    ];

    let world = createWorld(sectors, {});
    world = run(world, 30);

    expect(c1.called).toBe(30);
    expect(c3.called).toBe(10);
    expect(c5.called).toBe(6);
  });

  it("deterministic with same seed and cadences", () => {
    const sectors = () => [makeSector("a", 1), makeSector("b", 3)];

    let wA = createWorld(sectors(), {});
    let wB = createWorld(sectors(), {});

    for (let i = 0; i < 10; i++) {
      wA = tick(wA);
      wB = tick(wB);
    }

    expect(wA.tick).toBe(wB.tick);
    expect(wA.sectors.size).toBe(wB.sectors.size);
  });
});
