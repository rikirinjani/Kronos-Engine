/**
 * EXP-001E Phase 3 — SNAPSHOT DIFF
 *
 * Pinpoint exactly which field(s) of the rewind point's stored snapshot are
 * mutated by a parent run. Deep-serializes rp.sectorStates before and after
 * run(world, 50), then diffs.
 *
 * HARD BOUNDARIES: Diagnostic only.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { deersRockAdapter } from "../../sectors/deers-rock-adapter.js";
import type { Sector } from "../../sectors/types.js";
import { createWorld, run, resetUniverseCounter } from "../../engine/index.js";
import { createRewindPoint } from "../../timeline/index.js";

const SENTINEL = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };
const SEED = 1003;

function loadEraState(f: string, id: string): any {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return JSON.parse(readFileSync(join(__dirname, `../../../docs/history/${f}`), "utf-8")).states[id];
}

function buildSectorConfigs(era: any) {
  const en: any = {}; const tn: any = {};
  for (const n of era.nations) {
    en[n.id] = { gdp: n.gdp, gdpGrowthRate: 2.5, inflationRate: 3.0, tradeVolume: 50, unemploymentRate: 5.0 };
    tn[n.id] = { technologyLevel: n.technologyLevel, rdSpending: 0.01 + (n.technologyLevel / 100) * 0.025 };
  }
  return {
    geopolitics: { nations: era.nations, wars: era.wars, alliances: era.alliances, globalState: era.globalState, year: era.year, casualtyMultiplier: 1 },
    climate: { co2Concentration: 420, annualEmissions: 37, year: era.year, annualEmissionsNoise: 0.2 },
    economy: { nations: en, year: era.year },
    technology: { nations: tn, year: era.year },
  };
}

function createAllSectors(seed: number): Sector[] {
  return [
    createGeopoliticsSector(), createClimateSector(), createEconomySector(), createTechnologySector(),
    deersRockAdapter({ ...SENTINEL }, seed),
  ];
}

/** Recursively serialize any value into a comparable plain structure. */
function serialize(v: any, seen = new WeakSet()): any {
  if (v === null || typeof v !== "object") {
    if (typeof v === "number" && !Number.isFinite(v)) return String(v);
    return v;
  }
  if (seen.has(v)) return "[circular]";
  seen.add(v);
  if (v instanceof Map) {
    const obj: any = { __map: true, size: v.size };
    for (const [k, val] of v.entries()) obj[String(k)] = serialize(val, seen);
    return obj;
  }
  if (v instanceof Set) {
    return { __set: true, values: [...v].map(x => serialize(x, seen)) };
  }
  if (Array.isArray(v)) return v.map(x => serialize(x, seen));
  const proto = Object.getPrototypeOf(v);
  const obj: any = {};
  if (proto !== Object.prototype && proto !== null) obj.__class = v.constructor?.name ?? "?";
  for (const k of Object.keys(v)) obj[k] = serialize(v[k], seen);
  return obj;
}

/** Flatten to path→leaf map for diffing. */
function flatten(v: any, prefix = "", out: Record<string, any> = {}): Record<string, any> {
  if (v === null || typeof v !== "object") { out[prefix] = v; return out; }
  if (Array.isArray(v)) {
    out[prefix + ".length"] = v.length;
    v.forEach((x, i) => flatten(x, `${prefix}[${i}]`, out));
    return out;
  }
  for (const [k, val] of Object.entries(v)) flatten(val, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

resetUniverseCounter();
const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
const cfg = buildSectorConfigs(era);
const sectors = createAllSectors(SEED);
const w = createWorld(sectors, cfg, { seed: SEED });
const rp = createRewindPoint(w, "preseeded", { label: "t0", tags: [] });

const before = flatten(serialize(rp.sectorStates));
run(w, 50);
const after = flatten(serialize(rp.sectorStates));

const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
const changes: Array<{ path: string; before: any; after: any }> = [];
for (const k of keys) {
  const b = before[k];
  const a = after[k];
  if (JSON.stringify(b) !== JSON.stringify(a)) changes.push({ path: k, before: b, after: a });
}

console.log(`\n${"=".repeat(70)}`);
console.log(`EXP-001E Snapshot Diff — fields mutated by parent run`);
console.log(`${"=".repeat(70)}\n`);
console.log(`Total flattened fields: ${keys.size}`);
console.log(`Changed fields: ${changes.length}\n`);

for (const c of changes.slice(0, 200)) {
  console.log(`  ${c.path}`);
  console.log(`      before: ${JSON.stringify(c.before)}`);
  console.log(`      after:  ${JSON.stringify(c.after)}`);
}
if (changes.length > 200) console.log(`  ... and ${changes.length - 200} more`);

// Group changes by top-level sector
const bySector: Record<string, number> = {};
for (const c of changes) {
  const sector = c.path.split(".")[0] ?? "unknown";
  bySector[sector] = (bySector[sector] ?? 0) + 1;
}
console.log(`\nChanges by sector: ${JSON.stringify(bySector)}`);
