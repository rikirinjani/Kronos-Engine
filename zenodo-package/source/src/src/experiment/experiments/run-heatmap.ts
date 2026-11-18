import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { createSentinels } from "../../sectors/deers-rock-adapter.js";
import type { DeersRockSectorState, HospitalSentinelOutput } from "../../sectors/deers-rock-adapter.js";
import type { Sector, SectorState } from "../../sectors/types.js";
import { createWorld, run, snapshot, resetUniverseCounter } from "../../engine/index.js";
import type { WorldSnapshot } from "../../engine/world-engine.js";
import { createRewindPoint, forkBranch, resetBranchCounter, resetRewindCounter } from "../../timeline/index.js";
import { HOSPITAL_REGIONS } from "../../data/indonesian-hospitals.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface EraState { year: number; label: string; nations: any[]; wars: any[]; alliances: any[]; globalState: any; }
function loadEraState(): EraState {
  const raw = JSON.parse(readFileSync(join(__dirname, "../../../docs/history/era-contemporary.json"), "utf-8"));
  return raw.states["RP-CONTEMP-002"];
}
function buildConfigs(era: EraState) {
  const en: Record<string, any> = {};
  const tn: Record<string, any> = {};
  for (const n of era.nations) {
    en[n.id] = { gdp: n.gdp, gdpGrowthRate: 2.5, inflationRate: 3, tradeVolume: 50, unemploymentRate: 5 };
    tn[n.id] = { technologyLevel: n.technologyLevel, rdSpending: 0.01 + (n.technologyLevel / 100) * 0.025 };
  }
  return { geopolitics: { nations: era.nations, wars: era.wars, alliances: era.alliances, globalState: era.globalState, year: era.year, casualtyMultiplier: 1 }, climate: { co2Concentration: 420, annualEmissions: 37, year: era.year, annualEmissionsNoise: 0.2 }, economy: { nations: en, year: era.year }, technology: { nations: tn, year: era.year } };
}

function extract(p: WorldSnapshot, c: WorldSnapshot) {
  const pm = new Map(p.sectors.map(s => [s.id, s.state]));
  const cm = new Map(c.sectors.map(s => [s.id, s.state]));
  const out: Array<{ id: string; city: string; region: string; parentOcc: number; branchOcc: number; parentIcu: number; branchIcu: number; parentMort: number; branchMort: number; parentSurge: boolean; branchSurge: boolean }> = [];

  for (const [id] of pm) {
    const ps = pm.get(id) as unknown as DeersRockSectorState;
    if (ps._sectorId !== "deers-rock") continue;
    const cs = cm.get(id) as unknown as DeersRockSectorState | undefined;
    const region = HOSPITAL_REGIONS.find(r => r.hospitals.some(h => h.id === ps.config.id));
    out.push({
      id: ps.config.id, city: ps.config.city, region: region?.region ?? "unknown",
      parentOcc: ps.sentinelOutput?.occupancyRate ?? 0, branchOcc: cs?.sentinelOutput?.occupancyRate ?? 0,
      parentIcu: ps.sentinelOutput?.icuOccupancyRate ?? 0, branchIcu: cs?.sentinelOutput?.icuOccupancyRate ?? 0,
      parentMort: ps.sentinelOutput?.mortalityPressure ?? 0, branchMort: cs?.sentinelOutput?.mortalityPressure ?? 0,
      parentSurge: ps.sentinelOutput?.admissionSurge ?? false, branchSurge: cs?.sentinelOutput?.admissionSurge ?? false,
    });
  }
  return out;
}

const seedCount = 10;
const seeds = Array.from({ length: seedCount }, (_, i) => 42 + i);
const TICKS = 10;

console.log(`Running heatmap: ${seedCount} seeds, ${TICKS} ticks, ${HOSPITAL_REGIONS.flatMap(r => r.hospitals).length} hospitals...`);

const allHospitals = HOSPITAL_REGIONS.flatMap(r => r.hospitals.map(h => ({ ...h, ticksPerDay: 5 })));

const regionStats: Record<string, { occP: number[]; occB: number[]; icuP: number[]; icuB: number[]; mortP: number[]; mortB: number[]; surgeP: number; surgeB: number }> = {};

for (const seed of seeds) {
  resetUniverseCounter(); resetBranchCounter(); resetRewindCounter();
  const era = loadEraState();
  const configs = buildConfigs(era);
  const sectors: Sector[] = [createGeopoliticsSector(), createClimateSector(), createEconomySector(), createTechnologySector(), ...createSentinels(allHospitals, seed)];
  const sm = new Map(sectors.map(s => [s.id, s]));
  const w = createWorld(sectors, configs, { seed });
  const rp = createRewindPoint(w, "preseeded", { label: "COVID-19" });
  const parent = run(w, TICKS);
  const branch = forkBranch(w, rp, { climate: { annualEmissionsNoise: 0.02, co2Concentration: 400 } }, sm, TICKS, "Reduced emissions");

  const results = extract(snapshot(parent), branch.childSnapshot);
  for (const r of results) {
    if (!regionStats[r.region]) regionStats[r.region] = { occP: [], occB: [], icuP: [], icuB: [], mortP: [], mortB: [], surgeP: 0, surgeB: 0 };
    const rs = regionStats[r.region]!;
    rs.occP.push(r.parentOcc);
    rs.occB.push(r.branchOcc);
    rs.icuP.push(r.parentIcu);
    rs.icuB.push(r.branchIcu);
    rs.mortP.push(r.parentMort);
    rs.mortB.push(r.branchMort);
    if (r.parentSurge) rs.surgeP++;
    if (r.branchSurge) rs.surgeB++;
  }
  process.stdout.write(".");
}

console.log("\n\n=== REGIONAL HEALTH PRESSURE HEATMAP ===\n");

const output: any[] = [];
for (const region of HOSPITAL_REGIONS) {
  const s = regionStats[region.region];
  if (!s) continue;
  const n = s.occP.length;
  const avgOP = s.occP.reduce((a, b) => a + b, 0) / n;
  const avgOB = s.occB.reduce((a, b) => a + b, 0) / n;
  const avgIP = s.icuP.reduce((a, b) => a + b, 0) / n;
  const avgIB = s.icuB.reduce((a, b) => a + b, 0) / n;
  const avgMP = s.mortP.reduce((a, b) => a + b, 0) / n;
  const avgMB = s.mortB.reduce((a, b) => a + b, 0) / n;

  const occDelta = ((avgOB - avgOP) * 100).toFixed(1);
  const mortDelta = (avgMB - avgMP).toFixed(1);

  console.log(`${region.label} (${region.hospitals.length} hospitals, ${n} data points):`);
  console.log(`  Occupancy: ${(avgOP * 100).toFixed(1)}% → ${(avgOB * 100).toFixed(1)}% (Δ=${occDelta}pp)`);
  console.log(`  ICU: ${(avgIP * 100).toFixed(1)}% → ${(avgIB * 100).toFixed(1)}%`);
  console.log(`  Mortality: ${avgMP.toFixed(2)} → ${avgMB.toFixed(2)} (Δ=${mortDelta})`);
  console.log(`  Admission surges: ${s.surgeP} → ${s.surgeB}`);
  console.log();

  output.push({ region: region.label, hospitals: region.hospitals.length, dataPoints: n, parentOccupancy: Math.round(avgOP * 1000) / 1000, branchOccupancy: Math.round(avgOB * 1000) / 1000, parentIcu: Math.round(avgIP * 1000) / 1000, branchIcu: Math.round(avgIB * 1000) / 1000, parentMortality: Math.round(avgMP * 100) / 100, branchMortality: Math.round(avgMB * 100) / 100, parentSurges: s.surgeP, branchSurges: s.surgeB });
}

const outPath = join(__dirname, "../../../experiment-results/dr-counterfactual/heatmap.json");
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Heatmap saved to ${outPath}`);
