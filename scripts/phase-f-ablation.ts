/**
 * PHASE F — THREE-EDGE CAUSAL ABLATION (diagnostic only)
 *
 * Does NOT modify production code. Ablation is performed by removing the
 * targeted handler from the *sector instance* returned by the factory; the
 * engine reads record.sector.handlers at world-engine.ts:70, so instance-level
 * filtering is sufficient and leaves src/ untouched.
 *
 * Ablations:
 *   A0  original (all edges active)
 *   A1  climate edge ablated      : remove climate's ECONOMY_EVENTS.GDP_SHIFT handler
 *   A2  technology edge ablated   : remove technology's ECONOMY_EVENTS.GDP_SHIFT handler
 *   A3  severity->GDP ablated     : remove economy's CLIMATE_EVENTS.EXTREME_WEATHER handler
 *   A4  all three ablated
 *   A12, A13, A23  pairwise combinations
 *
 * Seeds: 42,43,44,45,46 (canonical Phase F) + 137 (seed-robustness probe)
 * Horizon: 20 KE ticks (matches frozen Phase F)
 *
 * Run: npx tsx scripts/phase-f-ablation.ts
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeopoliticsSector } from "../src/sectors/geopolitics.js";
import { createClimateSector } from "../src/sectors/climate.js";
import { createEconomySector } from "../src/sectors/economy.js";
import { createTechnologySector } from "../src/sectors/technology.js";
import { deersRockAdapter } from "../src/sectors/deers-rock-adapter.js";
import type { Sector, TickHandler } from "../src/sectors/types.js";
import { createWorld, run, resetUniverseCounter } from "../src/engine/index.js";
import { ECONOMY_EVENTS, CLIMATE_EVENTS } from "../src/sectors/events.js";

const HORIZON = 20;
const SEEDS = [42, 43, 44, 45, 46, 137];
const TARGET = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };

const __dirname = dirname(fileURLToPath(import.meta.url));

type AblationId = "A0" | "A1" | "A2" | "A3" | "A4" | "A12" | "A13" | "A23";
const ABLATIONS: Record<AblationId, { climateEdge: boolean; techEdge: boolean; severityEdge: boolean; label: string }> = {
  A0:  { climateEdge: false, techEdge: false, severityEdge: false, label: "original (all edges active)" },
  A1:  { climateEdge: true,  techEdge: false, severityEdge: false, label: "climate edge ablated" },
  A2:  { climateEdge: false, techEdge: true,  severityEdge: false, label: "technology edge ablated" },
  A3:  { climateEdge: false, techEdge: false, severityEdge: true,  label: "severity->GDP ablated" },
  A4:  { climateEdge: true,  techEdge: true,  severityEdge: true,  label: "all three ablated" },
  A12: { climateEdge: true,  techEdge: true,  severityEdge: false, label: "climate + technology" },
  A13: { climateEdge: true,  techEdge: false, severityEdge: true,  label: "climate + severity->GDP" },
  A23: { climateEdge: false, techEdge: true,  severityEdge: true,  label: "technology + severity->GDP" },
};

interface EraState {
  year: number;
  nations: Array<{ id: string; gdp: number; technologyLevel: number }>;
  wars: unknown[];
  alliances: unknown[];
  globalState: unknown;
}
function loadEraState(): EraState {
  const p = join(__dirname, "../docs/history/era-contemporary.json");
  const raw = JSON.parse(readFileSync(p, "utf-8")) as { states: Record<string, EraState> };
  return raw.states["RP-CONTEMP-002"]!;
}
function buildConfigs(era: EraState, co2: number): Record<string, Record<string, unknown>> {
  const economyNations: Record<string, Record<string, unknown>> = {};
  const techNations: Record<string, Record<string, unknown>> = {};
  for (const n of era.nations) {
    economyNations[n.id] = { gdp: n.gdp, gdpGrowthRate: 2.5, inflationRate: 3.0, tradeVolume: 50, unemploymentRate: 5.0 };
    techNations[n.id] = { technologyLevel: n.technologyLevel, rdSpending: 0.01 + (n.technologyLevel / 100) * 0.025 };
  }
  return {
    geopolitics: { nations: era.nations, wars: era.wars, alliances: era.alliances, globalState: era.globalState, year: era.year, casualtyMultiplier: 1 },
    climate: { co2Concentration: co2, annualEmissions: 37, year: era.year, annualEmissionsNoise: 0.2 },
    economy: { nations: economyNations, year: era.year },
    technology: { nations: techNations, year: era.year },
  };
}

/** Remove all handlers matching an event type from a sector INSTANCE. */
function removeHandlers(sector: Sector, eventType: string): number {
  const before = sector.handlers.length;
  sector.handlers = sector.handlers.filter((h: TickHandler) => h.eventType !== eventType);
  return before - sector.handlers.length;
}

const tickSink = { rdAdjustment: 0 };

function buildSectors(abl: typeof ABLATIONS[AblationId], seed: number): Sector[] {
  const geo = createGeopoliticsSector();
  const climate = createClimateSector();
  const economy = createEconomySector();
  const technology = createTechnologySector();
  const dr = deersRockAdapter({ ...TARGET }, seed);

  if (abl.climateEdge) removeHandlers(climate, ECONOMY_EVENTS.GDP_SHIFT);
  if (abl.techEdge) removeHandlers(technology, ECONOMY_EVENTS.GDP_SHIFT);
  if (abl.severityEdge) removeHandlers(economy, CLIMATE_EVENTS.EXTREME_WEATHER);

  // Instrument the technology GDP_SHIFT handler to record the ACTUAL rdAdjustment.
  // Diagnostic wrapper only; production source untouched.
  if (!abl.techEdge) {
    for (const h of technology.handlers) {
      if (h.eventType !== ECONOMY_EVENTS.GDP_SHIFT) continue;
      const orig = h.handle.bind(h);
      h.handle = (event: any, state: any) => {
        const n = state.nations?.[event.data.nationId];
        if (n) tickSink.rdAdjustment += (event.data.gdpDelta as number) * (n.rdSpending as number) * 0.5;
        return orig(event, state);
      };
    }
  }
  return [geo, climate, economy, technology, dr];
}

interface TickRow {
  tick: number;
  // climate
  co2: number; anomaly: number; eventChance: number;
  weatherTotal: number; severityMax: number; severityMean: number;
  // economy
  gdpTotal: number; gdpDelta: number; rateMean: number; rateMax: number; gdpFloorHits: number;
  // technology
  rdAdjustment: number; researchOutputMax: number; techLevelMax: number; techLevelMean: number; techCeilingHits: number;
  // hospital
  admissionMultiplier: number; supplyChainPressure: number; activeDisaster: string | null;
  occupancyRate: number | null; supplyStress: number | null; admissionSurge: boolean | null;
}

function runOne(seed: number, ablId: AblationId): TickRow[] {
  const abl = ABLATIONS[ablId];
  resetUniverseCounter();
  const era = loadEraState();
  const world = createWorld(buildSectors(abl, seed), buildConfigs(era, 280), { seed });
  const rows: TickRow[] = [];
  let prevGdpTotal = NaN;
  let prevWeatherCount = 0;
  let prevSeverities: number[] = [];
  let current = world;

  for (let t = 0; t < HORIZON; t++) {
    tickSink.rdAdjustment = 0;
    current = run(current, 1);

    const climate = current.sectors.get("climate")!.state as any;
    const economy = current.sectors.get("economy")!.state as any;
    const tech = current.sectors.get("technology")!.state as any;
    const drState = current.sectors.get(`deers-rock-${TARGET.id}`)!.state as any;

    const weatherEvents: any[] = climate.extremeEvents ?? [];
    const newEvents = weatherEvents.slice(prevWeatherCount);
    prevWeatherCount = weatherEvents.length;
    const sevs = newEvents.map((e) => e.severity as number);
    if (sevs.length) prevSeverities = sevs;
    const severityMax = weatherEvents.length ? Math.max(...weatherEvents.map((e) => e.severity as number)) : 0;
    const severityMean = weatherEvents.length ? weatherEvents.reduce((a, e) => a + (e.severity as number), 0) / weatherEvents.length : 0;

    const nations = Object.values(economy.nations) as any[];
    const gdpTotal = nations.reduce((a, n) => a + n.gdp, 0);
    const rates = nations.map((n) => n.gdpGrowthRate as number);
    const techNations = Object.values(tech.nations) as any[];
    const levels = techNations.map((n) => n.technologyLevel as number);

    const so = drState.sentinelOutput;

    rows.push({
      tick: current.tick,
      co2: climate.co2Concentration,
      anomaly: climate.temperatureAnomaly,
      eventChance: Math.max(0.05, Math.min(0.5, 0.1 + (climate.temperatureAnomaly - 1.2) * 0.05)),
      weatherTotal: weatherEvents.length,
      severityMax, severityMean,
      gdpTotal,
      gdpDelta: Number.isFinite(prevGdpTotal) ? gdpTotal - prevGdpTotal : 0,
      rateMean: rates.reduce((a, b) => a + b, 0) / rates.length,
      rateMax: Math.max(...rates),
      gdpFloorHits: nations.filter((n) => n.gdp <= 1e9 * 1.0001).length,
      rdAdjustment: tickSink.rdAdjustment,
      researchOutputMax: Math.max(...techNations.map((n) => n.researchOutput as number)),
      techLevelMax: Math.max(...levels),
      techLevelMean: levels.reduce((a, b) => a + b, 0) / levels.length,
      techCeilingHits: levels.filter((l) => l >= 99.999).length,
      admissionMultiplier: drState.world?.state?._admissionMultiplier ?? 0,
      supplyChainPressure: drState.world?.state?._supplyChainPressure ?? 0,
      activeDisaster: drState.world?.state?._activeMacroDisaster ?? null,
      occupancyRate: so ? so.occupancyRate : null,
      supplyStress: so ? so.supplyStress : null,
      admissionSurge: so ? so.admissionSurge : null,
    });
    prevGdpTotal = gdpTotal;
  }
  return rows;
}

// ---------------------------------------------------------------------------
const outDir = join(__dirname, "../experiment-results/phase-f-ablation");
mkdirSync(outDir, { recursive: true });

const ids = Object.keys(ABLATIONS) as AblationId[];
const results: Record<string, Record<string, TickRow[]>> = {};
const t0 = Date.now();

console.log("=== PHASE F THREE-EDGE CAUSAL ABLATION (diagnostic only) ===");
console.log(`ablations=${ids.length} seeds=[${SEEDS.join(",")}] horizon=${HORIZON} worlds=${ids.length * SEEDS.length}`);
console.log();

for (const id of ids) {
  results[id] = {};
  for (const seed of SEEDS) {
    results[id]![String(seed)] = runOne(seed, id);
  }
}
console.log(`Execution: ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

// ---- Per-ablation terminal summary (seed 42) ------------------------------
function at(abl: AblationId, seed: number, tick: number): TickRow {
  const r = results[abl]![String(seed)]!;
  return r[Math.min(tick, r.length - 1)]!;
}
function final(abl: AblationId, seed: number): TickRow {
  const r = results[abl]![String(seed)]!;
  return r[r.length - 1]!;
}

console.log("=== TERMINAL STATE, seed 42 (tick 20) ===");
console.log("abl | co2        | anomaly | chance | weather | sevMax | gdpTotal  | gdpFloor | techLvlMax/Mean | ceil | rdAdjSum  | occ    | supply");
for (const id of ids) {
  const f = final(id, 42);
  const rdSum = results[id]![String(42)]!.reduce((a, r) => a + r.rdAdjustment, 0);
  console.log(
    `${id.padEnd(3)} | ${f.co2.toExponential(2).padStart(10)} | ${f.anomaly.toFixed(2).padStart(7)} | ${f.eventChance.toFixed(3)} | ${String(f.weatherTotal).padStart(7)} | ` +
    `${f.severityMax.toFixed(1).padStart(6)} | ${f.gdpTotal.toExponential(2).padStart(9)} | ${String(f.gdpFloorHits).padStart(8)} | ` +
    `${f.techLevelMax.toFixed(0).padStart(6)}/${f.techLevelMean.toFixed(1).padStart(6)} | ${String(f.techCeilingHits).padStart(4)} | ${rdSum.toExponential(2).padStart(9)} | ` +
    `${f.occupancyRate === null ? "  n/a" : f.occupancyRate.toFixed(3)} | ${f.supplyStress === null ? "  n/a" : f.supplyStress.toFixed(3)}`
  );
}

// ---- Seed robustness ------------------------------------------------------
console.log("\n=== SEED ROBUSTNESS: terminal co2 / gdpTotal / techCeilingHits ===");
console.log("abl | seed | co2        | gdpTotal  | techCeil | sevMax");
for (const id of ["A0", "A1", "A3", "A4"] as AblationId[]) {
  for (const seed of SEEDS) {
    const f = final(id, seed);
    console.log(`${id.padEnd(3)} | ${String(seed).padStart(4)} | ${f.co2.toExponential(2).padStart(10)} | ${f.gdpTotal.toExponential(2).padStart(9)} | ${String(f.techCeilingHits).padStart(8)} | ${f.severityMax.toFixed(1)}`);
  }
}

// ---- Primary causal questions --------------------------------------------
console.log("\n=== PRIMARY CAUSAL QUESTIONS (seed 42; ranges over all seeds) ===");
const rng = (fn: (id: AblationId, s: number) => number, id: AblationId) => {
  const vals = SEEDS.map((s) => fn(id, s));
  return `[${Math.min(...vals).toExponential(2)} .. ${Math.max(...vals).toExponential(2)}]`;
};

console.log("\nQ1  Does ablating the climate edge prevent CO2 runaway?");
console.log(`    A0 final co2 ${rng((id, s) => final(id, s).co2, "A0")}  vs  A1 final co2 ${rng((id, s) => final(id, s).co2, "A1")}`);
console.log(`    A0 saturation tick (chance>=0.5): ${SEEDS.map((s) => results["A0"]![String(s)]!.find((r) => r.eventChance >= 0.5)?.tick ?? "-").join(",")}`);
console.log(`    A1 saturation tick (chance>=0.5): ${SEEDS.map((s) => results["A1"]![String(s)]!.find((r) => r.eventChance >= 0.5)?.tick ?? "never").join(",")}`);

console.log("\nQ2  Does ablating the technology edge prevent technology saturation, independently of the climate edge?");
for (const id of ["A0", "A2", "A1", "A4"] as AblationId[]) {
  const ceil = SEEDS.map((s) => final(id, s).techCeilingHits);
  const firstSat = SEEDS.map((s) => results[id]![String(s)]!.find((r) => r.techCeilingHits > 0)?.tick ?? "never");
  console.log(`    ${id}: ceiling hits ${JSON.stringify(ceil)} | first saturation tick ${JSON.stringify(firstSat)}`);
}

console.log("\nQ3  Does ablating severity->GDP prevent the GDP collapse, independently of the climate edge?");
for (const id of ["A0", "A3", "A1", "A4"] as AblationId[]) {
  const g = SEEDS.map((s) => final(id, s).gdpTotal);
  const floors = SEEDS.map((s) => final(id, s).gdpFloorHits);
  console.log(`    ${id}: final gdp ${JSON.stringify(g.map((v) => v.toExponential(2)))} | floor hits ${JSON.stringify(floors)}`);
}

console.log("\nQ4  Does ablating one edge alter another edge's behaviour?");
console.log(`    severityMax A0 ${JSON.stringify(SEEDS.map((s) => final("A0", s).severityMax.toFixed(1)))}`);
console.log(`    severityMax A1 ${JSON.stringify(SEEDS.map((s) => final("A1", s).severityMax.toFixed(1)))}`);
console.log(`    severityMax A2 ${JSON.stringify(SEEDS.map((s) => final("A2", s).severityMax.toFixed(1)))}`);
console.log(`    techCeil    A1 ${JSON.stringify(SEEDS.map((s) => final("A1", s).techCeilingHits))} (climate ablated, tech active)`);
console.log(`    techCeil    A2 ${JSON.stringify(SEEDS.map((s) => final("A2", s).techCeilingHits))} (tech ablated)`);

console.log("\nQ5  Is the all-three-ablation world (A4) numerically stable?");
for (const seed of SEEDS) {
  const f = final("A4", seed);
  console.log(`    seed ${String(seed).padStart(4)}: co2=${f.co2.toExponential(2)} anomaly=${f.anomaly.toFixed(3)} weather=${f.weatherTotal} sevMax=${f.severityMax.toFixed(2)} gdp=${f.gdpTotal.toExponential(2)} rateMean=${f.rateMean.toFixed(2)} techLvlMean=${f.techLevelMean.toFixed(1)}`);
}

// ---- Severity-bound investigation (G) ------------------------------------
console.log("\n=== SEVERITY-BOUND INVESTIGATION ===");
console.log("severity = round((1 + rng*4 + temperatureAnomaly*0.5)*10)/10");
console.log("intended anomaly range (co2 280..800): 0 .. 4.555 -> severity 1 .. 5.28");
console.log("observed anomaly range under A0 (runaway): " +
  `${Math.min(...SEEDS.map((s) => final("A0", s).anomaly)).toFixed(2)} .. ${Math.max(...SEEDS.map((s) => final("A0", s).anomaly)).toFixed(2)}`);
console.log("observed anomaly range under A1 (climate ablated): " +
  `${Math.min(...SEEDS.map((s) => final("A1", s).anomaly)).toFixed(3)} .. ${Math.max(...SEEDS.map((s) => final("A1", s).anomaly)).toFixed(3)}`);
console.log("observed severityMax under A0: " + JSON.stringify(SEEDS.map((s) => final("A0", s).severityMax.toFixed(1))));
console.log("observed severityMax under A1: " + JSON.stringify(SEEDS.map((s) => final("A1", s).severityMax.toFixed(1))));

writeFileSync(join(outDir, "ablation-results.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  horizon: HORIZON,
  seeds: SEEDS,
  ablations: ABLATIONS,
  results,
}, null, 2));
console.log(`\nSaved: ${outDir}/ablation-results.json`);
console.log("=== END ===");
