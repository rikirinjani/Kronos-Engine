import { describe, it, expect } from "vitest";
import { deepClone } from "./clone.js";

describe("deepClone", () => {
  it("clones primitives", () => {
    expect(deepClone(42)).toBe(42);
    expect(deepClone("hello")).toBe("hello");
    expect(deepClone(null)).toBeNull();
    expect(deepClone(undefined)).toBeUndefined();
    expect(deepClone(true)).toBe(true);
  });

  it("clones plain objects", () => {
    const obj = { a: 1, b: "two", c: true };
    const cloned = deepClone(obj);
    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
  });

  it("clones nested objects", () => {
    const obj: Record<string, unknown> = { a: { b: { c: [1, 2, { d: 3 }] } } };
    const cloned = deepClone(obj) as Record<string, unknown>;
    expect(cloned).toEqual(obj);
    (cloned.a as Record<string, unknown>).b = 99;
    expect((obj.a as Record<string, unknown>).b).toEqual({ c: [1, 2, { d: 3 }] });
  });

  it("clones arrays", () => {
    const arr = [1, "two", [3, 4]];
    const cloned = deepClone(arr) as unknown[];
    expect(cloned).toEqual(arr);
    expect(cloned).not.toBe(arr);
    expect(cloned[2]).not.toBe(arr[2]);
  });

  it("clones Maps", () => {
    const map = new Map<string, unknown>([["a", 1], ["b", { c: 2 }]]);
    const cloned = deepClone(map) as Map<string, unknown>;
    expect(cloned.get("a")).toBe(1);
    expect((cloned.get("b") as Record<string, number>).c).toBe(2);
    expect(cloned.get("b")).not.toBe(map.get("b"));
  });

  it("clones Sets", () => {
    const set = new Set([1, 2, 3]);
    const cloned = deepClone(set);
    expect(cloned.has(1)).toBe(true);
    expect(cloned.has(4)).toBe(false);
    expect(cloned).not.toBe(set);
  });
});
