import { describe, it, expect } from "vitest";
import { createRNG, restoreRNG } from "./rng.js";

describe("createRNG", () => {
  it("produces deterministic output for same seed", () => {
    const a = createRNG(42);
    const b = createRNG(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it("produces different output for different seeds", () => {
    const a = createRNG(42);
    const b = createRNG(99);
    const results = [a.next(), b.next()];
    expect(results[0]).not.toBe(results[1]);
  });

  it("returns values in [0, 1)", () => {
    const rng = createRNG(1);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("restoreRNG", () => {
  it("resumes from saved state producing identical sequence", () => {
    const rng = createRNG(42);
    for (let i = 0; i < 50; i++) rng.next();
    const state = rng.save();

    const rng2 = createRNG(42);
    for (let i = 0; i < 50; i++) rng2.next();

    const restored = restoreRNG(state);
    for (let i = 0; i < 100; i++) {
      expect(restored.next()).toBe(rng2.next());
    }
  });

  it("save/restore is idempotent with zero calls", () => {
    const rng = createRNG(42);
    const state = rng.save();

    const restored = restoreRNG(state);
    const fresh = createRNG(42);
    for (let i = 0; i < 50; i++) {
      expect(restored.next()).toBe(fresh.next());
    }
  });

  it("multiple save/restore cycles preserve determinism", () => {
    const rng = createRNG(7);
    for (let i = 0; i < 20; i++) rng.next();
    const s1 = rng.save();
    for (let i = 0; i < 30; i++) rng.next();
    const s2 = rng.save();

    const r1 = restoreRNG(s1);
    const r2 = restoreRNG(s2);

    const at20 = createRNG(7);
    for (let i = 0; i < 20; i++) at20.next();
    for (let i = 0; i < 50; i++) {
      expect(r1.next()).toBe(at20.next());
    }

    const at50 = createRNG(7);
    for (let i = 0; i < 50; i++) at50.next();
    for (let i = 0; i < 50; i++) {
      expect(r2.next()).toBe(at50.next());
    }
  });
});
