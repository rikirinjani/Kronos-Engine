import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { deersRockAdapter } from "../../sectors/deers-rock-adapter.js";
import type { Sector } from "../../sectors/types.js";
import { createWorld, tick, run, resetUniverseCounter, snapshot, restoreSnapshot } from "../../engine/index.js";
import { createRewindPoint, rewindToSnapshot } from "../../timeline/index.js";
import { createExp001ObserverSector } from "../exp-001-observer.js";

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
function patchState(state: any, ov: any): any {
  const r: any = { ...state };
  for (const [k, v] of Object.entries(ov)) {
    if (v && typeof v === "object" && !Array.isArray(v) && r[k] && typeof r[k] === "object") r[k] = patchState(r[k], v);
    else r[k] = v;
  }
  return r;
}
function occ(rec: any) {
  const so = rec?.state?.sentinelOutput ?? {};
  const inner = rec?.state?.world?.state ?? {};
  const beds = inner.beds instanceof Map ? [...inner.beds.values()] : [];
  return { occupancyRate: so.occupancyRate, beds: beds.filter((b: any) => b.patientId).length, supplyStress: so.supplyStress, admMult: inner._admissionMultiplier, supChain: inner._supplyChainPressure };
}

const args = process.argv.slice(2);
const seed = Number(args.find((a) => a.startsWith("--seed="))?.split("=")[1] ?? 1003);
const horizon = Number(args.find((a) => a.startsWith("--horizon="))?.split("=")[1] ?? 50);
const inter = { climate: { annualEmissionsNoise: 0.02, co2Concentration: 400 } };

resetUniverseCounter();
const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
const sectors: Sector[] = [
  createGeopoliticsSector(), createClimateSector(), createEconomySector(), createTechnologySector(),
  deersRockAdapter({ ...SENTINEL }, seed), createExp001ObserverSector(),
];
const sectorMap = new Map(sectors.map((s) => [s.id, s]));
const world = createWorld(sectors, buildSectorConfigs(era), { seed });
const rp = createRewindPoint(world, "preseeded", { label: "t0", tags: [] });

// --- replicate experiment order: run the PARENT first (mutates shared sector objects), THEN fork ---
const parentAfter = run(world, horizon);
{
  const pdr: any = parentAfter.sectors.get("deers-rock-makassar-001")?.state;
  const inner: any = pdr?.world?.state ?? {};
  const beds = inner.beds instanceof Map ? [...inner.beds.values()] : [];
  console.log(`[parent] final occ=${((pdr?.sentinelOutput?.occupancyRate) ?? 0).toFixed(3)} beds=${beds.filter((b:any)=>b.patientId).length} enc=${inner.encounters?.size}`);
}

// --- replicate forkBranch: restore rewind point, patch intervention, run horizon ---
const rewindSnap: any = {
  tick: rp.tick, rngState: rp.rngState,
  sectors: Object.entries(rp.sectorStates).map(([id, st]) => ({ id, state: st })),
  universeId: rp.universeId, sectorReconstructors: rp.sectorReconstructors,
};
let branch = restoreSnapshot(rewindSnap, sectorMap);
// apply intervention
const newSectors = new Map(branch.sectors);
for (const [sid, ov] of Object.entries(inter)) {
  const rec: any = newSectors.get(sid);
  if (rec) newSectors.set(sid, { sector: rec.sector, state: patchState(rec.state, ov) });
}
branch = { ...branch, sectors: newSectors };

const rows: any[] = [];
for (let t = 1; t <= horizon; t++) {
  branch = tick(branch);
  const dr = occ(branch.sectors.get("deers-rock-makassar-001"));
  const obs: any = branch.sectors.get("exp-001-observer")?.state ?? {};
  const hc: Record<string, number> = {};
  for (const [k, v] of Object.entries(obs.eventCounts ?? {})) if (k.startsWith("health.")) hc[k] = v as number;
  rows.push({ tick: t, ...dr, health: { ...hc } });
}
console.log(`BRANCH (forkBranch-replica) seed=${seed} H=${horizon}`);
for (const r of rows) console.log(`t=${String(r.tick).padStart(2)} occ=${(r.occupancyRate ?? 0).toFixed(3)} beds=${r.beds} supply=${(r.supplyStress ?? 0).toFixed(3)} admMult=${r.admMult} supChain=${r.supChain} health=${JSON.stringify(r.health)}`);
