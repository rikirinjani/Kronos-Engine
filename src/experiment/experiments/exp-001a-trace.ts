import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { deersRockAdapter } from "../../sectors/deers-rock-adapter.js";
import type { Sector } from "../../sectors/types.js";
import { createWorld, tick, snapshot, resetUniverseCounter } from "../../engine/index.js";
import { createExp001ObserverSector } from "../exp-001-observer.js";

const SENTINEL = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };

interface EraState {
  year: number; label: string; nations: any[]; wars: any[]; alliances: any[]; globalState: any;
}

function loadEraState(eraFile: string, rpId: string): EraState {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const path = join(__dirname, `../../../docs/history/${eraFile}`);
  const raw = JSON.parse(readFileSync(path, "utf-8")) as { states: Record<string, EraState> };
  return raw.states[rpId]!;
}

function buildSectorConfigs(era: EraState): Record<string, Record<string, unknown>> {
  const economyNations: Record<string, Record<string, unknown>> = {};
  const techNations: Record<string, Record<string, unknown>> = {};
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

function createAllSectors(worldSeed: number): Sector[] {
  return [
    createGeopoliticsSector(),
    createClimateSector(),
    createEconomySector(),
    createTechnologySector(),
    deersRockAdapter({ ...SENTINEL }, worldSeed),
    createExp001ObserverSector(),
  ];
}

function trace(seed: number, horizon: number) {
  resetUniverseCounter();
  const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
  const sectors = createAllSectors(seed);
  const configs = buildSectorConfigs(era);
  let world = createWorld(sectors, configs, { seed });

  const rows: any[] = [];
  for (let t = 1; t <= horizon; t++) {
    world = tick(world);
    const snap = snapshot(world);
    const drRec = snap.sectors.find((s) => s.id.startsWith("deers-rock"));
    const obsRec = snap.sectors.find((s) => s.id === "exp-001-observer");
    const dr: any = drRec?.state ?? {};
    const so: any = dr.sentinelOutput ?? {};
    const inner: any = dr.world?.state ?? {};
    const healthCounts: Record<string, number> = {};
    const oc: any = obsRec?.state ?? {};
    for (const [k, v] of Object.entries(oc.eventCounts ?? {})) {
      if (k.startsWith("health.")) healthCounts[k] = v as number;
    }
    rows.push({
      tick: t,
      occupancyRate: so.occupancyRate,
      icuOccupancyRate: so.icuOccupancyRate,
      mortalityPressure: so.mortalityPressure,
      supplyStress: so.supplyStress,
      staffStress: so.staffStress,
      admissionSurge: so.admissionSurge,
      encounters: inner.encounters ? (inner.encounters.size ?? Object.keys(inner.encounters).length) : null,
      morgue: Array.isArray(inner.morgue) ? inner.morgue.length : (inner.morgue?.length ?? null),
      healthEvents: { ...healthCounts },
      totalHealth: Object.values(healthCounts).reduce((a, b) => a + b, 0),
    });
  }
  return rows;
}

const args = process.argv.slice(2);
const seed = Number(args.find((a) => a.startsWith("--seed="))?.split("=")[1] ?? 1000);
const horizon = Number(args.find((a) => a.startsWith("--horizon="))?.split("=")[1] ?? 10);
const out = args.find((a) => a.startsWith("--out="))?.split("=")[1] ?? "/tmp/trace.json";

const rows = trace(seed, horizon);
writeFileSync(out, JSON.stringify({ seed, horizon, rows }, null, 2));
console.log(`traced seed=${seed} horizon=${horizon} -> ${out}`);
// print compact summary
for (const r of rows) {
  console.log(`t=${String(r.tick).padStart(2)} occ=${(r.occupancyRate ?? 0).toFixed(3)} icu=${(r.icuOccupancyRate ?? 0).toFixed(3)} mort=${r.mortalityPressure} supply=${(r.supplyStress ?? 0).toFixed(3)} staff=${(r.staffStress ?? 0).toFixed(3)} surge=${r.admissionSurge} enc=${r.encounters} morgue=${r.morgue} health=${JSON.stringify(r.healthEvents)}`);
}
