/**
 * Canonical, recursive serializer + FNV-1a hash for timeline integrity.
 *
 * The previous implementation used `JSON.stringify(obj, topLevelKeys)` which
 * restricted serialization to the root object's top-level keys at every nesting
 * level, silently dropping all nested state. This implementation captures the
 * full content of the value:
 *
 *  - objects: keys sorted lexicographically at every nesting level
 *  - arrays: preserved in order (never sorted)
 *  - primitives: type-tagged so distinct values never collide
 *  - Map: serialized as a sorted list of entries (not iteration order)
 *  - Set: serialized as a sorted list of values (not iteration order)
 *  - Date: serialized as ISO string
 *
 * Deterministic: two structurally-equal values always produce the same string.
 */

export function canonicalStringify(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  const t = typeof value;
  if (t === "boolean") return value ? "true" : "false";
  if (t === "number") {
    if (Number.isNaN(value)) return "number:NaN";
    if (value === Infinity) return "number:Infinity";
    if (value === -Infinity) return "number:-Infinity";
    return `number:${Object.is(value, -0) ? "-0" : String(value)}`;
  }
  if (t === "string") return JSON.stringify(value);
  if (t === "bigint") return `bigint:${value.toString()}`;
  if (t === "symbol") return `symbol:${value.toString()}`;
  if (t === "function") return "function:<callable>";

  if (value instanceof Date) return `date:${value.toISOString()}`;
  if (value instanceof Map) {
    const entries = [...value.entries()]
      .map(([k, v]) => `${canonicalStringify(k)}=>${canonicalStringify(v)}`)
      .sort();
    return `map:[${entries.join(",")}]`;
  }
  if (value instanceof Set) {
    const items = [...value]
      .map((item) => canonicalStringify(item))
      .sort();
    return `set:[${items.join(",")}]`;
  }
  if (Array.isArray(value)) {
    return `array:[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const parts = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`);
  return `object:{${parts.join(",")}}`;
}

export function hashState(obj: unknown): string {
  const str = canonicalStringify(obj);
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
