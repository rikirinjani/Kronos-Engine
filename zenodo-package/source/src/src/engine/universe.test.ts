import { describe, it, expect, beforeEach } from "vitest";
import { createUniverse, branchUniverse, resetUniverseCounter } from "./universe.js";

beforeEach(() => {
  resetUniverseCounter();
});

describe("createUniverse", () => {
  it("creates a root universe with no parent", () => {
    const u = createUniverse(42, "Baseline");
    expect(u.rngSeed).toBe(42);
    expect(u.parent).toBeNull();
    expect(u.rewindTick).toBeNull();
    expect(u.intervention).toBeNull();
    expect(u.label).toBe("Baseline");
    expect(u.id).toMatch(/^U-\d{4}-\d{4}$/);
  });

  it("increments IDs sequentially", () => {
    const a = createUniverse(1);
    const b = createUniverse(2);
    const aNum = parseInt(a.id.slice(-4), 10);
    const bNum = parseInt(b.id.slice(-4), 10);
    expect(bNum).toBe(aNum + 1);
  });

  it("defaults label when not provided", () => {
    const u = createUniverse(42);
    expect(u.label).toContain("U-");
  });
});

describe("branchUniverse", () => {
  it("creates a child universe with parent reference", () => {
    const parent = createUniverse(42, "Baseline");
    const child = branchUniverse(parent, 100, "what-if: no lockdown");

    expect(child.parent).toBe(parent.id);
    expect(child.rewindTick).toBe(100);
    expect(child.intervention).toBe("what-if: no lockdown");
    expect(child.rngSeed).toBe(42);
  });

  it("inherits seed from parent", () => {
    const parent = createUniverse(99, "Baseline");
    const child = branchUniverse(parent, 50, "alt policy");
    expect(child.rngSeed).toBe(parent.rngSeed);
  });

  it("has unique sequential IDs", () => {
    const parent = createUniverse(1);
    const c1 = branchUniverse(parent, 10, "a");
    const c2 = branchUniverse(parent, 20, "b");
    expect(c2.id).not.toBe(c1.id);
    const c1Num = parseInt(c1.id.slice(-4), 10);
    const c2Num = parseInt(c2.id.slice(-4), 10);
    expect(c2Num).toBe(c1Num + 1);
  });

  it("defaults label when not provided", () => {
    const parent = createUniverse(42);
    const child = branchUniverse(parent, 10, "test");
    expect(child.label).toContain("Branch from");
    expect(child.label).toContain(parent.id);
  });
});
