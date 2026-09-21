/**
 * CROSS-SECTOR COUPLING AUDIT — bounded deterministic micro-diagnostic.
 *
 * PURPOSE: answer "does the suspected defect materially alter the model
 * trajectory?" NOT to produce scientific evidence. NOT a Phase F rerun.
 *
 * Read-only w.r.t. production code. Does not modify any sector.
 * Small and deterministic — no GPU, no Monte Carlo, no N=50.
 *
 * Instrumented:
 *   - economy.gdpGrowthRate  (min/mean/max across nations) -> runaway test
 *   - economy.gdp            (total)                       -> compounding test
 *   - technology.researchOutput / technologyLevel          -> unit-defect test
 *   - climate.co2Concentration / temperatureAnomaly        -> reference (known defect)
 *   - WAR_START / INNOVATION counts (via wars[] / innovationCount deltas)
 *
 * Run: npx tsx scripts/audit-coupling-diagnostic.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeopoliticsSector } from "../src/sectors/geopolitics.js";
import { createClimateSector } from "../src/sectors/climate.js";
import { createEconomySector } from "../src/sectors/economy.js";
import { createTechnologySector } from "../src/sectors/technology.js";
import { deersRockAdapter } from "../src/sectors/deers-rock-adapter.js";
import type { Sector } from "../src/sectors/types.js";
import { createWorld, run, resetUniverseCounter } from "../src/engine/index.js";

const HORIZON = 20;
const SEED = 42;
const CONTROL_CO2 = 280;
const TARGET = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function sectors(): Sector[] {
  return [createGeopoliticsSector(), createClimateSector(), createEconomySector(), createTechnologySector(), deersRockAdapter({ ...TARGET }, SEED)];
}

resetUniverseCounter();
const era = loadEraState();
const world = createWorld(sectors(), buildConfigs(era, CONTROL_CO2), { seed: SEED });

console.log("=== CROSS-SECTOR COUPLING MICRO-DIAGNOSTIC ===");
console.log(`seed=${SEED} horizon=${HORIZON} co2=${CONTROL_CO2} sectors=geopolitics,climate,economy,technology,dr-adapter`);
console.log("Sector cadences: " + [...world.sectors.values()].map(r => `${r.sector.id}=${r.sector.cadence ?? 1}`).join(", "));
console.log();

const num = (v: unknown): number => (typeof v === "number" ? v : NaN);
const fmt = (v: number, d = 3): string => (Number.isFinite(v) ? v.toFixed(d) : "n/a");

interface Row {
  tick: number;
  co2: number;
  anomaly: number;
  chance: number;
  rateMin: number;
  rateMean: number;
  rateMax: number;
  gdpTotal: number;
  techROmax: number;
  techLevelMax: number;
  techLevelMean: number;
  wars: number;
  innovations: number;
}

const rows: Row[] = [];
let prevWars = 0;
let prevInnov = 0;

let current = world;
for (let t = 0; t < HORIZON; t++) {
  current = run(current, 1);

  const climate = current.sectors.get("climate")!.state as unknown as {
    co2Concentration: number; temperatureAnomaly: number;
  };
  const economy = current.sectors.get("economy")!.state as unknown as {
    nations: Record<string, { gdp: number; gdpGrowthRate: number; wars: unknown[] }>;
  };
  const tech = current.sectors.get("technology")!.state as unknown as {
    nations: Record<string, { researchOutput: number; technologyLevel: number; innovationCount: number }>;
  };

  const rates = Object.values(economy.nations).map((n) => num(n.gdpGrowthRate));
  const gdpTotal = Object.values(economy.nations).reduce((a, n) => a + num(n.gdp), 0);
  const roMax = Math.max(...Object.values(tech.nations).map((n) => num(n.researchOutput)));
  const lvls = Object.values(tech.nations).map((n) => num(n.technologyLevel));
  const wars = Object.values(economy.nations).reduce((a, n) => a + (n.wars?.length ?? 0), 0);
  const innovations = Object.values(tech.nations).reduce((a, n) => a + num(n.innovationCount), 0);

  const anomaly = num(climate.temperatureAnomaly);
  const chance = Math.max(0.05, Math.min(0.5, 0.1 + (anomaly - 1.2) * 0.05));

  rows.push({
    tick: current.tick,
    co2: num(climate.co2Concentration),
    anomaly,
    chance,
    rateMin: Math.min(...rates),
    rateMean: rates.reduce((a, b) => a + b, 0) / rates.length,
    rateMax: Math.max(...rates),
    gdpTotal,
    techROmax: roMax,
    techLevelMax: Math.max(...lvls),
    techLevelMean: lvls.reduce((a, b) => a + b, 0) / lvls.length,
    wars,
    innovations,
  });
  prevWars = wars;
  prevInnov = innovations;
}

console.log("tick | co2          | anomaly | chance | gdpRate[min/mean/max]        | gdpTotal      | techRO[max]   | techLvl[max/mean]");
for (const r of rows) {
  console.log(
    `${String(r.tick).padStart(4)} | ${r.co2.toExponential(2).padStart(12)} | ${fmt(r.anomaly, 2).padStart(7)} | ${fmt(r.chance, 3).padStart(6)} | ` +
    `${fmt(r.rateMin, 2).padStart(7)}/${fmt(r.rateMean, 2).padStart(7)}/${fmt(r.rateMax, 2).padStart(7)} | ` +
    `${r.gdpTotal.toExponential(2).padStart(13)} | ${r.techROmax.toExponential(2).padStart(13)} | ` +
    `${fmt(r.techLevelMax, 1).padStart(6)}/${fmt(r.techLevelMean, 1).padStart(6)}`
  );
}

// ---- Verdicts -------------------------------------------------------------
const r0 = rows[0]!, rN = rows[rows.length - 1]!;
console.log("\n=== VERDICTS ===");

console.log("\n[A1] gdpGrowthRate runaway test");
console.log(`  initial rate (all nations): 2.50`);
console.log(`  final   min/mean/max: ${fmt(rN.rateMin, 3)} / ${fmt(rN.rateMean, 3)} / ${fmt(rN.rateMax, 3)}`);
console.log(`  drift of mean: ${fmt(rN.rateMean - 2.5, 3)} pp over ${HORIZON} ticks`);
console.log(`  any rate > 10 pp: ${rows.some(r => r.rateMax > 10)} | any rate < -10 pp: ${rows.some(r => r.rateMin < -10)}`);
console.log(`  GDP total: ${r0.gdpTotal.toExponential(3)} -> ${rN.gdpTotal.toExponential(3)} (x${fmt(rN.gdpTotal / r0.gdpTotal, 3)})`);
console.log(`  WAR_START events (nation-wars accumulated): ${rN.wars} | INNOVATION events: ${rN.innovations}`);

console.log("\n[A2] technology rdAdjustment test");
console.log(`  researchOutput max: ${r0.techROmax.toExponential(3)} -> ${rN.techROmax.toExponential(3)}`);
console.log(`  technologyLevel max: ${fmt(r0.techLevelMax, 2)} -> ${fmt(rN.techLevelMax, 2)} (ceiling 100)`);
console.log(`  technologyLevel mean: ${fmt(r0.techLevelMean, 2)} -> ${fmt(rN.techLevelMean, 2)}`);
const satTick = rows.find(r => r.techLevelMax >= 99.999)?.tick ?? null;
console.log(`  first tick technologyLevel hits 100: ${satTick ?? "never"}`);

console.log("\n[REF] climate coupling (known confirmed defect)");
console.log(`  co2: ${r0.co2.toExponential(3)} -> ${rN.co2.toExponential(3)}`);
console.log(`  eventChance saturates at 0.5 from tick: ${rows.find(r => r.chance >= 0.5)?.tick ?? "never"}`);

console.log("\n=== END ===");
