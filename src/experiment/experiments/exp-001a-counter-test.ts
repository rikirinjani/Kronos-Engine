import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { deersRockAdapter } from "../../sectors/deers-rock-adapter.js";
import type { Sector } from "../../sectors/types.js";
import { createWorld, tick, run, resetUniverseCounter, restoreSnapshot } from "../../engine/index.js";
import { createRewindPoint } from "../../timeline/index.js";

// DR module-level counter resets
import { resetChargeCounter } from "../../../../Deers-Rock/dist/engine/charge-generator.js";
import { resetCssdCounters } from "../../../../Deers-Rock/dist/engine/cssd.js";
import { resetDialysisCounters } from "../../../../Deers-Rock/dist/engine/dialysis.js";
import { resetScenarioCounter } from "../../../../Deers-Rock/dist/engine/scenario.js";
import { resetBloodBankCounters } from "../../../../Deers-Rock/dist/engine/blood-bank.js";
import { resetClinicalNutritionCounters } from "../../../../Deers-Rock/dist/engine/clinical-nutrition.js";
import { resetIpcCounter } from "../../../../Deers-Rock/dist/engine/ipc.js";
import { resetMicrobiologyCounter } from "../../../../Deers-Rock/dist/engine/microbiology.js";
import { resetPathologyCounter } from "../../../../Deers-Rock/dist/engine/pathology.js";
import { resetMmConferenceCounter } from "../../../../Deers-Rock/dist/engine/mm-conference.js";
import { resetRadiotherapyCounters } from "../../../../Deers-Rock/dist/engine/radiotherapy.js";
import { resetBiomedCounter } from "../../../../Deers-Rock/dist/engine/biomedical-engineering.js";
import { resetJournalPurgeTick, resetJournalExportTick } from "../../../../Deers-Rock/dist/engine/journal.js";

function resetAllDrCounters() {
  resetChargeCounter(); resetCssdCounters(); resetDialysisCounters(); resetScenarioCounter();
  resetBloodBankCounters(); resetClinicalNutritionCounters(); resetIpcCounter();
  resetMicrobiologyCounter(); resetPathologyCounter(); resetMmConferenceCounter();
  resetRadiotherapyCounters(); resetBiomedCounter(); resetJournalPurgeTick(); resetJournalExportTick();
}

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
function patch(state: any, ov: any): any {
  const r: any = { ...state };
  for (const [k, v] of Object.entries(ov)) {
    if (v && typeof v === "object" && !Array.isArray(v) && r[k] && typeof r[k] === "object") r[k] = patch(r[k], v);
    else r[k] = v;
  }
  return r;
}

const seed = 1003, horizon = 50;
const inter = { climate: { annualEmissionsNoise: 0.02, co2Concentration: 400 } };

function buildAndFork(resetCounters: boolean) {
  resetUniverseCounter();
  const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
  const sectors: Sector[] = [
    createGeopoliticsSector(), createClimateSector(), createEconomySector(), createTechnologySector(),
    deersRockAdapter({ ...SENTINEL }, seed),
  ];
  const sectorMap = new Map(sectors.map((s) => [s.id, s]));
  const world = createWorld(sectors, buildSectorConfigs(era), { seed });
  const rp = createRewindPoint(world, "preseeded", { label: "t0", tags: [] });

  run(world, horizon); // parent mutates module-global counters

  if (resetCounters) resetAllDrCounters(); // <-- decisive intervention

  const rewindSnap: any = {
    tick: rp.tick, rngState: rp.rngState,
    sectors: Object.entries(rp.sectorStates).map(([id, st]) => ({ id, state: st })),
    universeId: rp.universeId, sectorReconstructors: rp.sectorReconstructors,
  };
  let branch = restoreSnapshot(rewindSnap, sectorMap);
  const ns = new Map(branch.sectors);
  for (const [sid, ov] of Object.entries(inter)) {
    const rec: any = ns.get(sid);
    if (rec) ns.set(sid, { sector: rec.sector, state: patch(rec.state, ov) });
  }
  branch = { ...branch, sectors: ns };

  let last: any = null;
  let health = 0;
  for (let t = 1; t <= horizon; t++) {
    branch = tick(branch);
    const dr: any = branch.sectors.get("deers-rock-makassar-001")?.state;
    const obs: any = branch.sectors.get("exp-001-observer")?.state;
    last = dr?.sentinelOutput?.occupancyRate;
    health = Object.entries(obs?.eventCounts ?? {}).filter(([k]) => k.startsWith("health.")).reduce((a: number, [, v]) => a + (v as number), 0);
  }
  return { finalOcc: last, healthEvents: health };
}

console.log("=== DECISIVE COUNTER TEST (seed 1003, H50) ===");
const a = buildAndFork(false);
console.log(`A) parent-run, counters NOT reset : finalOcc=${a.finalOcc?.toFixed(3)} healthEvents=${a.healthEvents}`);
const b = buildAndFork(true);
console.log(`B) parent-run, counters RESET     : finalOcc=${b.finalOcc?.toFixed(3)} healthEvents=${b.healthEvents}`);
console.log("");
console.log("If B reverts to ~0.824 / 0 health, the module-global ID counters are the contamination source.");
