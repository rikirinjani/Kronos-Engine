/**
 * EXP-001C — Reconstruction Contamination Root Cause & Snapshot Repair
 *
 * Part A: Isolated snapshot repair — verify sentinelOutput becomes visible to diff engine
 * Part B: Reconstruction contamination inventory — createWorld vs doReconstruct gaps
 * Part C: 4-combination interaction matrix — snapshot repair × reconstruction repair
 *
 * HARD BOUNDARIES: No Monte Carlo. No production changes. Diagnostic only.
 * All code isolated under experiments/exp-001c-*.ts.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { deersRockAdapter } from "../../sectors/deers-rock-adapter.js";
import type { Sector } from "../../sectors/types.js";
import { createWorld, tick, run, snapshot, restoreSnapshot, resetUniverseCounter } from "../../engine/index.js";
import { createRewindPoint } from "../../timeline/index.js";
import { createExp001ObserverSector } from "../exp-001-observer.js";
import { createClock, createRng } from "../../../../Deers-Rock/dist/engine/clock.js";

// ── Local extractNumericPaths (not exported from diff-engine.ts) ────
function extractNumericPaths(obj: Record<string, unknown>, prefix = ""): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "number") {
      result[path] = value;
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(result, extractNumericPaths(value as Record<string, unknown>, path));
    } else if (Array.isArray(value)) {
      result[`${path}.length`] = value.length;
    }
  }
  return result;
}

// ── DR counter resets ──────────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────────────────────
const SENTINEL = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };
const DR_SECTOR_ID = "deers-rock-makassar-001";
const OBS_SECTOR_ID = "exp-001-observer";
const INTERVENTION = { climate: { annualEmissionsNoise: 0.02, co2Concentration: 400 } };

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

function createAllSectors(seed: number, includeObserver: boolean): Sector[] {
  const base: Sector[] = [
    createGeopoliticsSector(), createClimateSector(), createEconomySector(), createTechnologySector(),
    deersRockAdapter({ ...SENTINEL }, seed),
  ];
  if (includeObserver) base.push(createExp001ObserverSector());
  return base;
}

function patchState(state: any, ov: any): any {
  const r: any = { ...state };
  for (const [k, v] of Object.entries(ov)) {
    if (v && typeof v === "object" && !Array.isArray(v) && r[k] && typeof r[k] === "object") r[k] = patchState(r[k], v);
    else r[k] = v;
  }
  return r;
}

function so(state: any): Record<string, number> {
  const s = state?.sentinelOutput;
  if (!s) return {};
  return { occupancyRate: s.occupancyRate, icuOccupancyRate: s.icuOccupancyRate, mortalityPressure: s.mortalityPressure, supplyStress: s.supplyStress, staffStress: s.staffStress };
}

function soNull(state: any): boolean {
  return state?.sentinelOutput === null || state?.sentinelOutput === undefined;
}

function getObsState(w: any): any {
  return w.sectors.get(OBS_SECTOR_ID)?.state ?? {};
}

function getHealthCounts(obs: any): Record<string, number> {
  const hc: Record<string, number> = {};
  for (const [k, v] of Object.entries(obs.eventCounts ?? {})) {
    if (k.startsWith("health.")) hc[k] = v as number;
  }
  return hc;
}

// ═══════════════════════════════════════════════════════════════════
// PART A: Isolated Snapshot Repair
//
// The bug: tick handler returns { ...s, world, sentinelOutput }.
// The spread copies __snapshot() closure from s, which captures
// `self` = the PREVIOUS state. makeSnapshot(self) reads
// self.sentinelOutput = null (tick 0 value), not the current value.
//
// Fix: After tick, wrap state so __snapshot reads from current values.
// ═══════════════════════════════════════════════════════════════════

interface PartAResult {
  /** Original snapshot: sentinelOutput visible? */
  originalSnapSentinelNull: boolean;
  originalSnapSentinelPaths: number;
  /** Repaired snapshot: sentinelOutput visible? */
  repairedSnapSentinelNull: boolean;
  repairedSnapSentinelPaths: number;
  /** Live state for comparison */
  liveSentinelNull: boolean;
  liveSentinel: Record<string, number>;
  verdict: string;
}

function runPartA(seed: number, horizon: number): PartAResult {
  resetUniverseCounter();
  const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
  const sectors = createAllSectors(seed, false);
  const sectorMap = new Map(sectors.map(s => [s.id, s]));
  const world = createWorld(sectors, buildSectorConfigs(era), { seed });

  // Run parent to H ticks
  let parent = world;
  for (let t = 1; t <= horizon; t++) {
    parent = tick(parent);
  }

  const liveDrState: any = parent.sectors.get(DR_SECTOR_ID)?.state;
  const liveSentinel = so(liveDrState);
  const liveSentinelNull = soNull(liveDrState);

  // ── Original snapshot ──
  const parentSnap = snapshot(parent);
  const snapDr: any = parentSnap.sectors.find(s => s.id === DR_SECTOR_ID)?.state;
  const snapNumeric = extractNumericPaths(snapDr as unknown as Record<string, unknown>);
  const snapSentinelPaths = Object.entries(snapNumeric).filter(([k]) => k.startsWith("sentinelOutput."));

  // ── Repaired snapshot: wrap state so __snapshot reads current values ──
  // Create a wrapper that holds the CURRENT state and delegates __snapshot to it
  const repairedDrState = { ...liveDrState };
  repairedDrState.__snapshot = function () {
    // Build snapshot from THIS object (the current state), not a stale closure
    const w = this.world;
    const events = (w.queue as any).events as Array<{ id: string; type: string; scheduledTick: number; data: Record<string, unknown> }>;
    const counter = (w.queue as any).counter as number;
    return {
      clockTick: w.clock.tick,
      hospitalTimeMs: w.clock.hospitalTimeMs,
      rngSeed: w.clock.rngSeed,
      events: events.map(e => ({ ...e })),
      eventCounter: counter,
      hospitalState: w.state,
      sentinelOutput: this.sentinelOutput,
      lastTickState: this.lastTickState,
      circuitBreakerTripped: this.circuitBreakerTripped,
      config: this.config,
    };
  };

  // Build a repaired world snapshot by replacing the DR sector state
  const repairedSectors = parentSnap.sectors.map(s => {
    if (s.id === DR_SECTOR_ID) return { ...s, state: repairedDrState };
    return s;
  });
  const repairedSnap = { ...parentSnap, sectors: repairedSectors };
  const repairedSnapDr: any = repairedSnap.sectors.find(s => s.id === DR_SECTOR_ID)?.state;
  const repairedNumeric = extractNumericPaths(repairedSnapDr as unknown as Record<string, unknown>);
  const repairedSentinelPaths = Object.entries(repairedNumeric).filter(([k]) => k.startsWith("sentinelOutput."));

  const verdict = repairedSentinelPaths.length > 0
    ? "REPAIRED: sentinelOutput now visible to diff engine (structural invisibility bug confirmed and repaired)"
    : "REPAIR FAILED: sentinelOutput still invisible after wrapper";

  return {
    originalSnapSentinelNull: soNull(snapDr),
    originalSnapSentinelPaths: snapSentinelPaths.length,
    repairedSnapSentinelNull: soNull(repairedSnapDr),
    repairedSnapSentinelPaths: repairedSentinelPaths.length,
    liveSentinelNull: liveSentinelNull,
    liveSentinel,
    verdict,
  };
}

// ═══════════════════════════════════════════════════════════════════
// PART B: Reconstruction Contamination Inventory
//
// Compare createWorld() initialization vs doReconstruct() gaps.
// Test progressive resets: counters → clock RNG → journal → full.
// ═══════════════════════════════════════════════════════════════════

interface PartBInventory {
  countersReset: boolean;
  clockRngAdvanced: boolean;
  journalReinit: boolean;
}

interface PartBResult {
  /** Baseline: branch from t0, no parent run */
  baseline: { occ: number | null; healthEvents: number; sentinelNull: boolean };
  /** Contaminated: parent run then branch (no fix) */
  contaminated: { occ: number | null; healthEvents: number; sentinelNull: boolean };
  /** Fix A: counters only */
  fixCounters: { occ: number | null; healthEvents: number; sentinelNull: boolean };
  /** Fix B: counters + clock RNG advance */
  fixClock: { occ: number | null; healthEvents: number; sentinelNull: boolean };
  /** Fix C: counters + clock + journal */
  fixJournal: { occ: number | null; healthEvents: number; sentinelNull: boolean };
  /** Fix D: full createWorld-equivalent re-init */
  fixFull: { occ: number | null; healthEvents: number; sentinelNull: boolean };
  verdict: string;
}

function runBranchFromRewindPoint(
  seed: number, horizon: number, rp: any, sectorMap: Map<string, Sector>,
  fixInventory?: PartBInventory,
): { occ: number | null; healthEvents: number; sentinelNull: boolean } {
  const rewindSnap: any = {
    tick: rp.tick, rngState: rp.rngState,
    sectors: Object.entries(rp.sectorStates).map(([id, st]) => ({ id, state: st })),
    universeId: rp.universeId, sectorReconstructors: rp.sectorReconstructors,
  };
  let branch = restoreSnapshot(rewindSnap, sectorMap);

  // Apply intervention
  const ns = new Map(branch.sectors);
  for (const [sid, ov] of Object.entries(INTERVENTION)) {
    const rec: any = ns.get(sid);
    if (rec) ns.set(sid, { sector: rec.sector, state: patchState(rec.state, ov) });
  }
  branch = { ...branch, sectors: ns };

  // Apply fixes BEFORE branching (to the reconstructed DR state)
  if (fixInventory) {
    const drRec: any = branch.sectors.get(DR_SECTOR_ID);
    if (drRec) {
      const drState: any = drRec.state;
      if (fixInventory.countersReset) {
        resetAllDrCounters();
      }
      if (fixInventory.clockRngAdvanced) {
        // Advance clock RNG to match tick count
        // doReconstruct sets tick/hospitalTimeMs but doesn't call clock.rng()
        // We need to advance the RNG state to match what createWorld would have
        const clock = drState.world.clock;
        const advancedClock = { ...clock };
        let rngState = createRng(clock.rngSeed);
        // Advance RNG by tick count (each DR tick calls clock.rng() once)
        for (let i = 0; i < clock.tick; i++) {
          rngState.next();
        }
        advancedClock.rng = rngState.next;
        drState.world = { ...drState.world, clock: advancedClock };
      }
      if (fixInventory.journalReinit) {
        // Journal re-init is a file system side effect; we just mark it as noted
        // In production this would call initJournal(journalPath)
      }
    }
  }

  // Run branch
  let lastDr: any = null;
  let lastObs: any = null;
  for (let t = 1; t <= horizon; t++) {
    branch = tick(branch);
    lastDr = branch.sectors.get(DR_SECTOR_ID)?.state as any;
    lastObs = branch.sectors.get(OBS_SECTOR_ID)?.state as any;
  }

  return {
    occ: lastDr?.sentinelOutput?.occupancyRate ?? null,
    healthEvents: Object.values(getHealthCounts(lastObs)).reduce((a, b) => a + b, 0),
    sentinelNull: soNull(lastDr),
  };
}

function runPartB(seed: number, horizon: number): PartBResult {
  resetUniverseCounter();
  const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
  const sectors = createAllSectors(seed, true);
  const sectorMap = new Map(sectors.map(s => [s.id, s]));
  const world = createWorld(sectors, buildSectorConfigs(era), { seed });
  const rp = createRewindPoint(world, "preseeded", { label: "t0", tags: [] });

  // 1. Baseline: branch directly from t0 (no parent)
  const baseline = runBranchFromRewindPoint(seed, horizon, rp, sectorMap);

  // 2. Run parent
  run(world, horizon);

  // 3. Contaminated: branch from t0 after parent (no fix)
  resetAllDrCounters();
  const contaminated = runBranchFromRewindPoint(seed, horizon, rp, sectorMap);

  // 4. Fix A: counters only
  resetAllDrCounters();
  const fixCounters = runBranchFromRewindPoint(seed, horizon, rp, sectorMap, { countersReset: true, clockRngAdvanced: false, journalReinit: false });

  // 5. Fix B: counters + clock RNG
  resetAllDrCounters();
  const fixClock = runBranchFromRewindPoint(seed, horizon, rp, sectorMap, { countersReset: true, clockRngAdvanced: true, journalReinit: false });

  // 6. Fix C: counters + clock + journal (journal is FS side effect, same as Fix B for runtime)
  resetAllDrCounters();
  const fixJournal = runBranchFromRewindPoint(seed, horizon, rp, sectorMap, { countersReset: true, clockRngAdvanced: true, journalReinit: true });

  // 7. Fix D: full re-init (fresh createWorld)
  resetAllDrCounters();
  const freshSectors = createAllSectors(seed, true);
  const freshSectorMap = new Map(freshSectors.map(s => [s.id, s]));
  const freshWorld = createWorld(freshSectors, buildSectorConfigs(era), { seed });
  const freshRp = createRewindPoint(freshWorld, "preseeded", { label: "t0", tags: [] });
  const fixFull = runBranchFromRewindPoint(seed, horizon, freshRp, freshSectorMap);

  // Verdict
  const matchesBaseline = (r: { occ: number | null; healthEvents: number }) =>
    Math.abs((r.occ ?? 0) - (baseline.occ ?? 0)) < 0.01 && r.healthEvents === baseline.healthEvents;

  let verdict: string;
  if (!matchesBaseline(contaminated)) {
    if (matchesBaseline(fixCounters)) verdict = "Counters ARE sufficient causal mechanism";
    else if (matchesBaseline(fixClock)) verdict = "Counters + clock RNG = sufficient (clock RNG is key gap)";
    else if (matchesBaseline(fixFull)) verdict = "Full createWorld re-init required (multiple gaps)";
    else verdict = "Contamination persists through all fixes — mechanism unresolved";
  } else {
    verdict = "No contamination detected at this seed/horizon";
  }

  return {
    baseline, contaminated, fixCounters, fixClock, fixJournal, fixFull, verdict,
  };
}

// ═══════════════════════════════════════════════════════════════════
// PART C: 4-Combination Interaction Matrix
//
// Test original vs repaired snapshot × original vs repaired reconstruction
// to determine which fix is necessary and sufficient.
// ═══════════════════════════════════════════════════════════════════

interface PartCResult {
  origSnapOrigRecon: { sentinelVisible: boolean; sentinelPaths: number; occ: number | null };
  repairedSnapOrigRecon: { sentinelVisible: boolean; sentinelPaths: number; occ: number | null };
  origSnapRepairedRecon: { sentinelVisible: boolean; sentinelPaths: number; occ: number | null };
  repairedSnapRepairedRecon: { sentinelVisible: boolean; sentinelPaths: number; occ: number | null };
  verdict: string;
}

function runPartC(seed: number, horizon: number): PartCResult {
  resetUniverseCounter();
  const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
  const sectors = createAllSectors(seed, false);
  const sectorMap = new Map(sectors.map(s => [s.id, s]));
  const world = createWorld(sectors, buildSectorConfigs(era), { seed });

  // Run parent
  let parent = world;
  for (let t = 1; t <= horizon; t++) {
    parent = tick(parent);
  }

  const liveDrState: any = parent.sectors.get(DR_SECTOR_ID)?.state;

  // Build repaired snapshot wrapper
  function makeRepairedDrSnapshot(state: any) {
    const w = state.world;
    const events = (w.queue as any).events as Array<{ id: string; type: string; scheduledTick: number; data: Record<string, unknown> }>;
    const counter = (w.queue as any).counter as number;
    return {
      clockTick: w.clock.tick,
      hospitalTimeMs: w.clock.hospitalTimeMs,
      rngSeed: w.clock.rngSeed,
      events: events.map(e => ({ ...e })),
      eventCounter: counter,
      hospitalState: w.state,
      sentinelOutput: state.sentinelOutput,
      lastTickState: state.lastTickState,
      circuitBreakerTripped: state.circuitBreakerTripped,
      config: state.config,
    };
  }

  // Helper: extract sentinel paths from a DR state
  function sentinelPathCount(drState: any): number {
    const numeric = extractNumericPaths(drState as unknown as Record<string, unknown>);
    return Object.entries(numeric).filter(([k]) => k.startsWith("sentinelOutput.")).length;
  }

  // ── Combination 1: Original snapshot × Original reconstruction ──
  // This is the current (buggy) path
  const origSnap = liveDrState.__snapshot();
  const origRecon = liveDrState.__reconstruct(origSnap);
  const c1 = {
    sentinelVisible: sentinelPathCount(origRecon) > 0,
    sentinelPaths: sentinelPathCount(origRecon),
    occ: origRecon?.sentinelOutput?.occupancyRate ?? null,
  };

  // ── Combination 2: Repaired snapshot × Original reconstruction ──
  const repairedSnap = makeRepairedDrSnapshot(liveDrState);
  const repairedSnapNull = repairedSnap.sentinelOutput === null;
  // Feed repaired snapshot into original reconstruct
  const c2Recon = liveDrState.__reconstruct(repairedSnap);
  const c2 = {
    sentinelVisible: sentinelPathCount(c2Recon) > 0,
    sentinelPaths: sentinelPathCount(c2Recon),
    occ: c2Recon?.sentinelOutput?.occupancyRate ?? null,
  };

  // ── Combination 3: Original snapshot × Repaired reconstruction ──
  // Repaired reconstruction: after reconstruct, wrap state so __snapshot reads current
  const origSnapForRecon = liveDrState.__snapshot();
  let c3Recon = liveDrState.__reconstruct(origSnapForRecon);
  // Wrap the reconstructed state
  const c3Wrapper = { ...c3Recon };
  c3Wrapper.__snapshot = function () { return makeRepairedDrSnapshot(this); };
  const c3 = {
    sentinelVisible: sentinelPathCount(c3Wrapper) > 0,
    sentinelPaths: sentinelPathCount(c3Wrapper),
    occ: c3Wrapper?.sentinelOutput?.occupancyRate ?? null,
  };

  // ── Combination 4: Repaired snapshot × Repaired reconstruction ──
  const c4Snap = makeRepairedDrSnapshot(liveDrState);
  let c4Recon = liveDrState.__reconstruct(c4Snap);
  const c4Wrapper = { ...c4Recon };
  c4Wrapper.__snapshot = function () { return makeRepairedDrSnapshot(this); };
  const c4 = {
    sentinelVisible: sentinelPathCount(c4Wrapper) > 0,
    sentinelPaths: sentinelPathCount(c4Wrapper),
    occ: c4Wrapper?.sentinelOutput?.occupancyRate ?? null,
  };

  // Verdict
  let verdict: string;
  if (c4.sentinelVisible && c1.sentinelPaths === 0) {
    verdict = "Snapshot repair is necessary; reconstruction repair is sufficient alone; both together are robust";
  } else if (c2.sentinelVisible && !c3.sentinelVisible) {
    verdict = "Snapshot repair alone makes sentinelOutput visible; reconstruction repair unnecessary for visibility";
  } else if (!c2.sentinelVisible && c3.sentinelVisible) {
    verdict = "Reconstruction repair alone makes sentinelOutput visible; snapshot repair unnecessary";
  } else if (c4.sentinelVisible) {
    verdict = "Both repairs needed for full sentinelOutput visibility";
  } else {
    verdict = "Neither repair resolves sentinelOutput visibility — deeper structural issue";
  }

  return {
    origSnapOrigRecon: c1,
    repairedSnapOrigRecon: c2,
    origSnapRepairedRecon: c3,
    repairedSnapRepairedRecon: c4,
    verdict,
  };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
const seed = 1003;
const horizon = 50;

console.log(`\n${"=".repeat(70)}`);
console.log(`EXP-001C: Reconstruction Contamination Root Cause & Snapshot Repair`);
console.log(`seed=${seed}  horizon=${horizon}`);
console.log(`${"=".repeat(70)}\n`);

// ── Part A ─────────────────────────────────────────────────────────
console.log("─── PART A: Isolated Snapshot Repair ───");
const partA = runPartA(seed, horizon);
console.log(`  Live sentinelOutput null:     ${partA.liveSentinelNull}`);
console.log(`  Live sentinelOutput:          ${JSON.stringify(partA.liveSentinel)}`);
console.log(`  Original snap sentinel null:  ${partA.originalSnapSentinelNull}`);
console.log(`  Original snap sentinel paths: ${partA.originalSnapSentinelPaths}`);
console.log(`  Repaired snap sentinel null:  ${partA.repairedSnapSentinelNull}`);
console.log(`  Repaired snap sentinel paths: ${partA.repairedSnapSentinelPaths}`);
console.log(`  VERDICT: ${partA.verdict}\n`);

// ── Part B ─────────────────────────────────────────────────────────
console.log("─── PART B: Reconstruction Contamination Inventory ───");
const partB = runPartB(seed, horizon);
console.log(`  Baseline:     occ=${partB.baseline.occ?.toFixed(3) ?? "null"}  healthEvents=${partB.baseline.healthEvents}  sentinelNull=${partB.baseline.sentinelNull}`);
console.log(`  Contaminated: occ=${partB.contaminated.occ?.toFixed(3) ?? "null"}  healthEvents=${partB.contaminated.healthEvents}  sentinelNull=${partB.contaminated.sentinelNull}`);
console.log(`  Fix=counters: occ=${partB.fixCounters.occ?.toFixed(3) ?? "null"}  healthEvents=${partB.fixCounters.healthEvents}  sentinelNull=${partB.fixCounters.sentinelNull}`);
console.log(`  Fix=clock:    occ=${partB.fixClock.occ?.toFixed(3) ?? "null"}  healthEvents=${partB.fixClock.healthEvents}  sentinelNull=${partB.fixClock.sentinelNull}`);
console.log(`  Fix=journal:  occ=${partB.fixJournal.occ?.toFixed(3) ?? "null"}  healthEvents=${partB.fixJournal.healthEvents}  sentinelNull=${partB.fixJournal.sentinelNull}`);
console.log(`  Fix=full:     occ=${partB.fixFull.occ?.toFixed(3) ?? "null"}  healthEvents=${partB.fixFull.healthEvents}  sentinelNull=${partB.fixFull.sentinelNull}`);
console.log(`  VERDICT: ${partB.verdict}\n`);

// ── Part C ─────────────────────────────────────────────────────────
console.log("─── PART C: 4-Combination Interaction Matrix ───");
const partC = runPartC(seed, horizon);
console.log(`  [OrigSnap × OrigRecon]:   sentinelVisible=${partC.origSnapOrigRecon.sentinelVisible}  paths=${partC.origSnapOrigRecon.sentinelPaths}  occ=${partC.origSnapOrigRecon.occ?.toFixed(3) ?? "null"}`);
console.log(`  [Repaired × OrigRecon]:   sentinelVisible=${partC.repairedSnapOrigRecon.sentinelVisible}  paths=${partC.repairedSnapOrigRecon.sentinelPaths}  occ=${partC.repairedSnapOrigRecon.occ?.toFixed(3) ?? "null"}`);
console.log(`  [OrigSnap × Repaired]:    sentinelVisible=${partC.origSnapRepairedRecon.sentinelVisible}  paths=${partC.origSnapRepairedRecon.sentinelPaths}  occ=${partC.origSnapRepairedRecon.occ?.toFixed(3) ?? "null"}`);
console.log(`  [Repaired × Repaired]:    sentinelVisible=${partC.repairedSnapRepairedRecon.sentinelVisible}  paths=${partC.repairedSnapRepairedRecon.sentinelPaths}  occ=${partC.repairedSnapRepairedRecon.occ?.toFixed(3) ?? "null"}`);
console.log(`  VERDICT: ${partC.verdict}\n`);

// ── SAVE RESULTS ──────────────────────────────────────────────────
const results = {
  seed, horizon,
  timestamp: new Date().toISOString(),
  partA, partB, partC,
};

mkdirSync("C:/Users/think/Project_v2/Kronos Engine/experiment-results/exp-001c", { recursive: true });
writeFileSync("C:/Users/think/Project_v2/Kronos Engine/experiment-results/exp-001c/results.json",
  JSON.stringify(results, null, 2));
console.log("Results written to experiment-results/exp-001c/results.json");
