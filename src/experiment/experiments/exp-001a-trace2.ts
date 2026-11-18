import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { deersRockAdapter } from "../../sectors/deers-rock-adapter.js";
import type { Sector } from "../../sectors/types.js";
import { createWorld, tick, resetUniverseCounter } from "../../engine/index.js";
import { createExp001ObserverSector } from "../exp-001-observer.js";

const SENTINEL = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };

function loadEraState(eraFile: string, rpId: string): any {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return JSON.parse(readFileSync(join(__dirname, `../../../docs/history/${eraFile}`), "utf-8")).states[rpId];
}
function buildSectorConfigs(era: any) {
  const economyNations: any = {}; const techNations: any = {};
  for (const n of era.nations) {
    economyNations[n.id] = { gdp: n.gdp, gdpGrowthRate: 2.5, inflationRate: 3.0, tradeVolume: 50, unemploymentRate: 5.0 };
    techNations[n.id] = { technologyLevel: n.technologyLevel, rdSpending: 0.01 + (n.technologyLevel / 100) * 0.025 };
  }
  return {
    geopolitics: { nations: era.nations, wars: era.wars, alliances: era.alliances, globalState: era.globalState, year: era.year, casualtyMultiplier: 1 },
    climate: { co2Concentration: 420, annualEmissions: 37, year: era.year, annualEmissionsNoise: 0.2 },
    economy: { nations: economyNations, year: era.year },
    technology: { nations: techNations, year: era.year },
  };
}

const args = process.argv.slice(2);
const seed = Number(args.find((a) => a.startsWith("--seed="))?.split("=")[1] ?? 1003);
const horizon = Number(args.find((a) => a.startsWith("--horizon="))?.split("=")[1] ?? 50);
const inter = args.includes("--intervene");

resetUniverseCounter();
const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
const sectors: Sector[] = [
  createGeopoliticsSector(), createClimateSector(), createEconomySector(), createTechnologySector(),
  deersRockAdapter({ ...SENTINEL }, seed), createExp001ObserverSector(),
];
let world = createWorld(sectors, buildSectorConfigs(era), { seed });

// optional intervention applied at tick 0 (mirrors exp-001 forkBranch)
if (inter) {
  const dr = world.sectors.get("climate")!;
  const st: any = { ...dr.state, annualEmissionsNoise: 0.02, co2Concentration: 400 };
  world = { ...world, sectors: new Map(world.sectors).set("climate", { sector: dr.sector, state: st }) };
}

const rows: any[] = [];
for (let t = 1; t <= horizon; t++) {
  world = tick(world);
  // read LIVE state (not snapshot)
  const drRec: any = world.sectors.get("deers-rock-makassar-001");
  const obsRec: any = world.sectors.get("exp-001-observer");
  const drState: any = drRec?.state ?? {};
  const so: any = drState.sentinelOutput ?? {};
  const inner: any = drState.world?.state ?? {};
  const beds = inner.beds instanceof Map ? [...inner.beds.values()] : [];
  const occupied = beds.filter((b: any) => b.patientId).length;
  const encSize = inner.encounters instanceof Map ? inner.encounters.size : (inner.encounters ? Object.keys(inner.encounters).length : 0);
  const patientsSize = inner.patients instanceof Map ? inner.patients.size : (inner.patients ? Object.keys(inner.patients).length : 0);
  const healthCounts: Record<string, number> = {};
  for (const [k, v] of Object.entries(obsRec?.state?.eventCounts ?? {})) if (k.startsWith("health.")) healthCounts[k] = v as number;
  rows.push({
    tick: t,
    occupancyRate: so.occupancyRate, icuOccupancyRate: so.icuOccupancyRate,
    mortalityPressure: so.mortalityPressure, supplyStress: so.supplyStress, staffStress: so.staffStress,
    admissionSurge: so.admissionSurge,
    bedsTotal: beds.length, bedsOccupied: occupied,
    patientsSize, encSize, morgue: Array.isArray(inner.morgue) ? inner.morgue.length : null,
    admissionMultiplier: inner._admissionMultiplier, supplyChainPressure: inner._supplyChainPressure,
    healthEvents: { ...healthCounts }, totalHealth: Object.values(healthCounts).reduce((a, b) => a + b, 0),
  });
}

const out = args.find((a) => a.startsWith("--out="))?.split("=")[1] ?? "/tmp/trace2.json";
writeFileSync(out, JSON.stringify({ seed, horizon, intervene: inter, rows }, null, 2));
console.log(`seed=${seed} H=${horizon} intervene=${inter} -> ${out}`);
for (const r of rows) {
  console.log(`t=${String(r.tick).padStart(2)} occ=${(r.occupancyRate ?? 0).toFixed(3)} beds=${r.bedsOccupied}/${r.bedsTotal} patients=${r.patientsSize} enc=${r.encSize} morgue=${r.morgue} supply=${(r.supplyStress ?? 0).toFixed(3)} admMult=${r.admissionMultiplier} supChain=${r.supplyChainPressure} health=${JSON.stringify(r.healthEvents)}`);
}
