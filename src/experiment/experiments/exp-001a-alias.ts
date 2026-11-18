import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { deersRockAdapter } from "../../sectors/deers-rock-adapter.js";
import type { Sector } from "../../sectors/types.js";
import { createWorld, tick, run, resetUniverseCounter } from "../../engine/index.js";
import { createRewindPoint } from "../../timeline/index.js";

const SENTINEL = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };
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
function occOf(sectorState: any) {
  const inner = sectorState?.world?.state ?? {};
  const beds = inner.beds instanceof Map ? [...inner.beds.values()] : [];
  return { occupied: beds.filter((b: any) => b.patientId).length, total: beds.length, morgue: (inner.morgue?.length ?? 0), enc: inner.encounters instanceof Map ? inner.encounters.size : -1 };
}
function occFromSnapshotCanonical(canonical: any) {
  // canonical is DeersRockWorldSnapshot: { hospitalState: {...} }
  const hs = canonical?.hospitalState ?? {};
  const beds = hs.beds instanceof Map ? [...hs.beds.values()] : [];
  return { occupied: beds.filter((b: any) => b.patientId).length, total: beds.length, morgue: (hs.morgue?.length ?? 0), enc: hs.encounters instanceof Map ? hs.encounters.size : -1 };
}

const seed = 1003;
resetUniverseCounter();
const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
const sectors: Sector[] = [
  createGeopoliticsSector(), createClimateSector(), createEconomySector(), createTechnologySector(),
  deersRockAdapter({ ...SENTINEL }, seed),
];
const sectorMap = new Map(sectors.map((s) => [s.id, s]));
const world = createWorld(sectors, buildSectorConfigs(era), { seed });

const rp = createRewindPoint(world, "preseeded", { label: "t0", tags: [] });
const rpCanonical = rp.sectorStates["deers-rock-makassar-001"] as any;

console.log("=== ALIASING TEST (seed 1003) ===");
console.log("BEFORE parent run:");
console.log("  live world hospital   :", JSON.stringify(occOf(world.sectors.get("deers-rock-makassar-001")?.state)));
console.log("  rewind-point canonical:", JSON.stringify(occFromSnapshotCanonical(rpCanonical)));

// run the parent to H50 (mutates the same DR world objects if step() is in-place)
const parent = run(world, 50);

console.log("\nAFTER parent run (H50):");
console.log("  live parent hospital  :", JSON.stringify(occOf(parent.sectors.get("deers-rock-makassar-001")?.state)));
console.log("  rewind-point canonical:", JSON.stringify(occFromSnapshotCanonical(rpCanonical)));
console.log("\n  >>> If rewind-point canonical changed, the rewind point is ALIASED to the parent's mutated state.");
console.log("  rpCanonical.hospitalState === parent hospital state object? ",
  (rpCanonical?.hospitalState === (parent.sectors.get("deers-rock-makassar-001")?.state as any)?.world?.state));
console.log("  rpCanonical.hospitalState === original world hospital state object? ",
  (rpCanonical?.hospitalState === (world.sectors.get("deers-rock-makassar-001")?.state as any)?.world?.state));
