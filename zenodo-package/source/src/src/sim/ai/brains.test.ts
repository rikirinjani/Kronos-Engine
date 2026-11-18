import { describe, it, expect } from "vitest";
import { utilityPick, softmaxPick, TinyMLP, MarkovChain, fsmStep, goapPlan, MemoryRing } from "./brains.js";
import type { RNG } from "../../sectors/types.js";

function seededRNG(seed: number): RNG {
  let s = seed | 0;
  return { next: () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } };
}

describe("utilityPick", () => {
  it("picks the highest score", () => {
    const result = utilityPick([{ label: "a", score: 1 }, { label: "b", score: 5 }, { label: "c", score: 3 }]);
    expect(result).toBe("b");
  });

  it("picks first if all equal", () => {
    const result = utilityPick([{ label: "a", score: 5 }, { label: "b", score: 5 }]);
    expect(result).toBe("a");
  });
});

describe("softmaxPick", () => {
  it("returns a valid option", () => {
    const rng = seededRNG(42);
    const result = softmaxPick([{ label: "a", score: 1 }, { label: "b", score: 10 }], 1, rng);
    expect(["a", "b"]).toContain(result);
  });

  it("deterministic with same seed", () => {
    const rng1 = seededRNG(42);
    const rng2 = seededRNG(42);
    const opts = [{ label: "x", score: 3 }, { label: "y", score: 7 }, { label: "z", score: 5 }];
    expect(softmaxPick(opts, 1, rng1)).toBe(softmaxPick(opts, 1, rng2));
  });
});

describe("TinyMLP", () => {
  it("produces output of correct size", () => {
    const mlp = new TinyMLP(3, 4, 2, seededRNG(42));
    const out = mlp.forward(new Float64Array([1, 0, 1]));
    expect(out.length).toBe(2);
  });

  it("deterministic with same weights", () => {
    const a = new TinyMLP(2, 3, 1, seededRNG(42));
    const b = new TinyMLP(2, 3, 1, seededRNG(42));
    const inp = new Float64Array([0.5, -0.3]);
    const outA = a.forward(inp);
    const outB = b.forward(inp);
    expect(outA[0]).toBe(outB[0]);
  });
});

describe("MarkovChain", () => {
  it("generates sequences from training", () => {
    const mc = new MarkovChain(1, seededRNG(42));
    mc.train(["a", "b", "a", "c", "a", "b", "c"]);
    const gen = mc.generate(5);
    expect(gen.length).toBeGreaterThan(0);
  });

  it("deterministic", () => {
    const a = new MarkovChain(1, seededRNG(42));
    a.train(["x", "y", "x", "z"]);
    const b = new MarkovChain(1, seededRNG(42));
    b.train(["x", "y", "x", "z"]);
    expect(a.generate(4)).toEqual(b.generate(4));
  });

  it("returns empty for untrained chain", () => {
    const mc = new MarkovChain(1, seededRNG(42));
    expect(mc.generate(5)).toEqual([]);
  });
});

describe("fsmStep", () => {
  it("transitions on matching rule", () => {
    const rules = [{ from: "idle", on: "start", to: "running" }, { from: "running", on: "stop", to: "idle" }];
    expect(fsmStep("idle", "start", rules)).toBe("running");
    expect(fsmStep("running", "stop", rules)).toBe("idle");
  });

  it("stays in state on no match", () => {
    const result = fsmStep("idle", "unknown", [{ from: "idle", on: "start", to: "running" }]);
    expect(result).toBe("idle");
  });
});

describe("goapPlan", () => {
  it("returns a valid plan when possible", () => {
    const actions: import("./brains.js").GOAPAction[] = [
      { name: "gather", cost: 1, preconditions: {} as Record<string, boolean>, effects: { hasWood: true } },
      { name: "build", cost: 2, preconditions: { hasWood: true }, effects: { shelter: true } },
    ];
    const plan = goapPlan({}, { shelter: true }, actions);
    expect(plan).not.toBeNull();
    expect(plan!.map((a) => a.name)).toEqual(["gather", "build"]);
  });

  it("returns null for impossible goal", () => {
    const plan = goapPlan({}, { impossible: true }, [{ name: "nothing", cost: 1, preconditions: {}, effects: {} }]);
    expect(plan).toBeNull();
  });
});

describe("MemoryRing", () => {
  it("remembers and recalls items", () => {
    const ring = new MemoryRing<string>(3);
    ring.remember("a"); ring.remember("b"); ring.remember("c");
    expect(ring.recallAll()).toEqual(["a", "b", "c"]);
  });

  it("wraps around when full", () => {
    const ring = new MemoryRing<string>(2);
    ring.remember("a"); ring.remember("b"); ring.remember("c");
    expect(ring.recallAll()).toEqual(["b", "c"]);
  });

  it("recalls limited count", () => {
    const ring = new MemoryRing<number>(10);
    for (let i = 0; i < 10; i++) ring.remember(i);
    expect(ring.recall(3)).toEqual([7, 8, 9]);
  });
});
