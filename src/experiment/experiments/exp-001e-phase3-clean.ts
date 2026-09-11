/**
 * EXP-001E Phase 3 — CLEAN (one variant per process)
 *
 * Cross-case contamination has muddied prior results. This script runs exactly
 * ONE variant per process invocation, so module-global state starts fresh.
 *
 * Usage: node dist/experiment/experiments/exp-001e-phase3-clean.js <variant>
 * Variants:
 *   fresh-clone          createWorld → rp → branch (clone rewind state)
 *   fresh-noclone        createWorld → rp → branch (no clone)
 *   parent50-clone       createWorld → rp → run 50 → branch (clone)
 *   parent50-noclone     createWorld → rp → run 50 → branch (no clone)
 *   parent50-reset-clone createWorld → rp → run 50 → reset counters → branch (clone)
 *   parent50-twice-clone createWorld → rp → run 50 → branch (clone) twice
 *   fresh-twice-noclone  createWorld → rp → branch (no clone) twice
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
import { createWorld, tick as kronosTick, run, restoreSnapshot, resetUniverseCounter } from "../../engine/index.js";
import { createRewindPoint } from "../../timeline/index.js";
import { deepClone } from "../../engine/clone.js";

// DR counter resets
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
import { resetPatientCounter } from "../../../../Deers-Rock/dist/patient/generator.js";
import { resetNikCounter } from "../../../../Deers-Rock/dist/identity/generator.js";
import { resetAgentCounter } from "../../../../Deers-Rock/dist/agent/generator.js";

function resetAllDrCounters() {
  resetPatientCounter(); resetNikCounter(); resetAgentCounter();
  resetChargeCounter(); resetCssdCounters(); resetDialysisCounters(); resetScenarioCounter();
  resetBloodBankCounters(); resetClinicalNutritionCounters(); resetIpcCounter();
  resetMicrobiologyCounter(); resetPathologyCounter(); resetMmConferenceCounter();
  resetRadiotherapyCounters(); resetBiomedCounter(); resetJournalPurgeTick(); resetJournalExportTick();
}

const SENTINEL = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };
const DR_SECTOR_ID = "deers-rock-makassar-001";
const INTERVENTION = { climate: { annualEmissionsNoise: 0.02, co2Concentration: 400 } };
const SEED = 1003;
const HORIZON = 50;

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

function patchState(state: any, ov: any): any {
  const r: any = { ...state };
  for (const [k, v] of Object.entries(ov)) {
    if (v && typeof v === "object" && !Array.isArray(v) && r[k] && typeof r[k] === "object") r[k] = patchState(r[k], v);
    else r[k] = v;
  }
  return r;
}

function runBranch(rp: any, sectorMap: Map<string, Sector>, cloneStates: boolean, statesOverride?: any): any {
  const src = statesOverride ?? rp.sectorStates;
  const rewindSnap: any = {
    tick: rp.tick, rngState: rp.rngState,
    sectors: Object.entries(src).map(([id, st]) => ({ id, state: cloneStates ? deepClone(st) : st })),
    universeId: rp.universeId, sectorReconstructors: rp.sectorReconstructors,
  };
  let branch = restoreSnapshot(rewindSnap, sectorMap);
  const ns = new Map(branch.sectors);
  for (const [sid, ov] of Object.entries(INTERVENTION)) {
    const rec: any = ns.get(sid);
    if (rec) ns.set(sid, { sector: rec.sector, state: patchState(rec.state, ov) });
  }
  branch = { ...branch, sectors: ns };

  let lastDr: any = null;
  for (let t = 1; t <= HORIZON; t++) {
    branch = kronosTick(branch);
    lastDr = branch.sectors.get(DR_SECTOR_ID)?.state as any;
  }
  return lastDr;
}

function extractResult(drState: any): any {
  const inner: any = drState?.world?.state ?? {};
  const beds = inner.beds instanceof Map ? [...inner.beds.values()] : [];
  return {
    occ: drState?.sentinelOutput?.occupancyRate ?? null,
    enc: inner.encounters?.size ?? null,
    pts: beds.filter((b: any) => b.patientId).length,
  };
}

const variant = process.argv[2];
if (!variant) { console.error("Usage: <variant>"); process.exit(1); }

const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
const cfg = buildSectorConfigs(era);

function setup() {
  resetUniverseCounter();
  const sectors = createAllSectors(SEED);
  const sm = new Map(sectors.map(s => [s.id, s]));
  const w = createWorld(sectors, cfg, { seed: SEED });
  const rp = createRewindPoint(w, "preseeded", { label: "t0", tags: [] });
  return { w, rp, sm };
}

let out: any = { variant, seed: SEED, horizon: HORIZON };

switch (variant) {
  case "fresh-clone": {
    const { rp, sm } = setup();
    out.runs = [extractResult(runBranch(rp, sm, true))];
    break;
  }
  case "fresh-noclone": {
    const { rp, sm } = setup();
    out.runs = [extractResult(runBranch(rp, sm, false))];
    break;
  }
  case "fresh-twice-noclone": {
    const { rp, sm } = setup();
    out.runs = [extractResult(runBranch(rp, sm, false)), extractResult(runBranch(rp, sm, false))];
    break;
  }
  case "parent50-clone": {
    const { w, rp, sm } = setup();
    run(w, 50);
    out.runs = [extractResult(runBranch(rp, sm, true))];
    break;
  }
  case "parent50-noclone": {
    const { w, rp, sm } = setup();
    run(w, 50);
    out.runs = [extractResult(runBranch(rp, sm, false))];
    break;
  }
  case "parent50-reset-clone": {
    const { w, rp, sm } = setup();
    run(w, 50);
    resetAllDrCounters();
    out.runs = [extractResult(runBranch(rp, sm, true))];
    break;
  }
  case "parent50-twice-clone": {
    const { w, rp, sm } = setup();
    run(w, 50);
    out.runs = [extractResult(runBranch(rp, sm, true)), extractResult(runBranch(rp, sm, true))];
    break;
  }
  case "fresh-preclone": {
    // Snapshot the rewind states BEFORE anything else, reconstruct from that copy.
    const { rp, sm } = setup();
    const clean = Object.fromEntries(Object.entries(rp.sectorStates).map(([id, st]) => [id, deepClone(st)]));
    out.runs = [extractResult(runBranch(rp, sm, true, clean))];
    break;
  }
  case "parent50-preclone": {
    // Snapshot the rewind states BEFORE the parent run, then reconstruct from that
    // clean copy AFTER the parent run. If this returns 0.8244, the parent's effect
    // is entirely via rewind-state mutation. If 0.9084, there is a global factor.
    const { w, rp, sm } = setup();
    const clean = Object.fromEntries(Object.entries(rp.sectorStates).map(([id, st]) => [id, deepClone(st)]));
    run(w, 50);
    out.runs = [extractResult(runBranch(rp, sm, true, clean))];
    break;
  }
  case "parent50-preclone-reset": {
    const { w, rp, sm } = setup();
    const clean = Object.fromEntries(Object.entries(rp.sectorStates).map(([id, st]) => [id, deepClone(st)]));
    run(w, 50);
    resetAllDrCounters();
    out.runs = [extractResult(runBranch(rp, sm, true, clean))];
    break;
  }
  default:
    console.error(`Unknown variant: ${variant}`);
    process.exit(1);
}

console.log(JSON.stringify(out));
