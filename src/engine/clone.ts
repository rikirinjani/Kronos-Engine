/**
 * Extract canonical serializable state from a Snapshotable object.
 * Returns the snapshot if the object is Snapshotable, otherwise deepClones.
 */
export function extractSnapshot<T>(obj: T): unknown {
  if (obj !== null && typeof obj === "object" && "__snapshot" in obj && "__reconstruct" in obj) {
    return (obj as any).__snapshot();
  }
  return deepClone(obj);
}

/**
 * Rebuild a runtime object from a canonical snapshot.
 * If the original had __reconstruct, uses it to create fresh runtime instances.
 * Otherwise, deepClones the snapshot.
 */
export function reconstructFromSnapshot<T>(original: T, snapshot: unknown): T {
  if (original !== null && typeof original === "object" && "__reconstruct" in (original as any)) {
    return (original as any).__reconstruct(snapshot);
  }
  return deepClone(snapshot as T);
}

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(deepClone) as unknown as T;
  if (obj instanceof Map) return new Map(Array.from(obj.entries()).map(([k, v]) => [k, deepClone(v)])) as unknown as T;
  if (obj instanceof Set) return new Set(obj) as unknown as T;

  // Check for Snapshotable interface — use semantic reconstruction instead of reference-sharing
  if ("__snapshot" in obj && "__reconstruct" in obj) {
    const snapshotFn = (obj as any).__snapshot;
    const reconstructFn = (obj as any).__reconstruct;
    const snapshot = snapshotFn.call(obj);
    return reconstructFn.call(obj, snapshot);
  }

  // Class instances without Snapshotable: return by reference (known limitation)
  if (Object.getPrototypeOf(obj) !== Object.prototype) return obj;

  const cloned: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
  }
  return cloned as T;
}
