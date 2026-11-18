/**
 * VULTR SENSITIVITY — EXPLORATORY, NON-CANONICAL
 *
 * Purpose: probe where the macro intervention signal attenuates/disappears,
 *          using ONLY existing KE/DR parameters. Does NOT modify any frozen
 *          Phase F code, DR source, or canonical evidence.
 *
 * Semantics: identical to Phase F (fresh-world paired execution; arms differ
 *            only in the swept factor). Single target sentinel to keep cost low.
 *
 * Usage:
 *   node dist/experiment/experiments/vultr-sensitivity.js \
 *     --label=A_H20_T10_C800 --horizon=20 --ticksPerDay=10 \
 *     --controlCo2=280 --interventionCo2=800 \
 *     --annualEmissions=37 --noise=0.2 --gdpGrowth=2.5 \
 *     --seeds=42,43,44,45,46,47,48,49
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import type { Nation as GeoNation, War, Alliance, GlobalState } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { deersRockAdapter } from "../../sectors/deers-rock-adapter.js";
import type { Sector } from "../../sectors/types.js";
import { createWorld, run, snapshot, resetUniverseCounter } from "../../engine/index.js";
import { hashState } from "../../timeline/hash.js";
import type { DeersRockSectorState, HospitalSentinelOutput } from "../../sectors/deers-rock-adapter.js";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function arg(name: string, dflt: string): string {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`));
  return p ? p.slice(name.length + 3) : dflt;
}
const LABEL = arg("label", "pilot");
const HORIZON = parseInt(arg("horizon", "20"), 10);
const TICKS_PER_DAY = parseInt(arg("ticksPerDay", "10"), 10);
const CONTROL_CO2 = parseFloat(arg("controlCo2", "280"));
const INTERVENTION_CO2 = parseFloat(arg("interventionCo2", "800"));
const ANNUAL_EMISSIONS = parseFloat(arg("annualEmissions", "37"));
const NOISE = parseFloat(arg("noise", "0.2"));
const GDP_GROWTH = parseFloat(arg("gdpGrowth", "2.5"));
const SEEDS = arg("seeds", "42,43,44,45,46,47,48,49").split(",").map((s) => parseInt(s, 10));
const FULL_TRACE = arg("trace", "0") === "1";
const EXPERIMENT_ID = "VULTR-SENS-2026-09-10";

const TARGET = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: TICKS_PER_DAY };
// Match Phase F exactly: each sector.init consumes one world-RNG draw, so the
// sentinel set determines the KE RNG stream. 3 sentinels => Phase F-identical baseline.
const ISOLATION_SENTINELS = [
  { id: "sentinel-B", city: "Makassar", beds: 133, patients: 50, ticksPerDay: TICKS_PER_DAY },
  { id: "sentinel-C", city: "Makassar", beds: 133, patients: 50, ticksPerDay: TICKS_PER_DAY },
];

interface EraState {
  year: number; label: string; nations: GeoNation[]; wars: War[]; alliances: Alliance[]; globalState: GlobalState;
}

function loadEraState(): EraState {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const path = join(__dirname, "../../../docs/history/era-contemporary.json");
  const raw = JSON.parse(readFileSync(path, "utf-8")) as { states: Record<string, EraState> };
  return raw.states["RP-CONTEMP-002"]!;
}

function createSectors(worldSeed: number): Sector[] {
  return [
    createGeopoliticsSector(),
    createClimateSector(),
    createEconomySector(),
    createTechnologySector(),
    deersRockAdapter({ ...TARGET }, worldSeed),
    ...ISOLATION_SENTINELS.map((c) => deersRockAdapter({ ...c }, worldSeed)),
  ];
}

function buildSectorConfigs(era: EraState, co2: number): Record<string, Record<string, unknown>> {
  const economyNations: Record<string, Record<string, unknown>> = {};
  const techNations: Record<string, Record<string, unknown>> = {};
  for (const n of era.nations) {
    economyNations[n.id] = { gdp: n.gdp, gdpGrowthRate: GDP_GROWTH, inflationRate: 3.0, tradeVolume: 50, unemploymentRate: 5.0 };
    techNations[n.id] = { technologyLevel: n.technologyLevel, rdSpending: 0.01 + (n.technologyLevel / 100) * 0.025 };
  }
  return {
    geopolitics: { nations: era.nations, wars: era.wars, alliances: era.alliances, globalState: era.globalState, year: era.year, casualtyMultiplier: 1 },
    climate: { co2Concentration: co2, annualEmissions: ANNUAL_EMISSIONS, year: era.year, annualEmissionsNoise: NOISE },
    economy: { nations: economyNations, year: era.year },
    technology: { nations: techNations, year: era.year },
  };
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

interface TickRow {
  t: number; co2: number; anomaly: number; eventChance: number; weather: number;
  admitMult: number; supplyPressure: number; scenario: string | null;
  occ: number; icu: number; mort: number; supplyStress: number; occupiedBeds: number;
}

interface ArmResult {
  arm: string; co2Initial: number; weatherTicks: number[]; weatherTotal: number;
  adapterEventCount: number; firstWeatherTick: number | null;
  rows: TickRow[]; final: HospitalSentinelOutput; finalHash: string; bHash: string; cHash: string;
}

function runArm(seed: number, co2: number, arm: string): ArmResult {
  resetUniverseCounter();
  const era = loadEraState();
  const world = createWorld(createSectors(seed), buildSectorConfigs(era, co2), { seed });
  const rows: TickRow[] = [];
  const weatherTicks: number[] = [];
  let adapterEventCount = 0;

  // Instrument adapter→DR event scheduling (read-only wrapper)
  const drRec0 = world.sectors.get(`deers-rock-${TARGET.id}`)!;
  const s0 = drRec0.state as DeersRockSectorState;
  const origSchedule = s0.world.queue.schedule.bind(s0.world.queue);
  (s0.world.queue as unknown as { schedule: typeof origSchedule }).schedule =
    (type: string, delayTicks: number, data: Record<string, unknown> = {}) => {
      if (["admission_surge", "supply_chain_pressure", "active_disaster", "staff_shortage"].includes(type)) adapterEventCount++;
      return origSchedule(type, delayTicks, data);
    };

  let current = world;
  for (let t = 0; t < HORIZON; t++) {
    current = run(current, 1);
    const climate = current.sectors.get("climate")!.state as unknown as {
      co2Concentration: number; temperatureAnomaly: number; extremeEvents: Array<{ type: string }>;
    };
    const eventChance = Math.max(0.05, Math.min(0.5, 0.1 + (climate.temperatureAnomaly - 1.2) * 0.05));
    const drRec = current.sectors.get(`deers-rock-${TARGET.id}`)!;
    const dr = drRec.state as DeersRockSectorState;
    const hs = dr.world.state as unknown as {
      _admissionMultiplier: number; _supplyChainPressure: number; _activeMacroDisaster?: string;
      _scenario?: { active: { type: string } | null };
      beds: Map<string, { patientId: string | null }>;
    };
    const so = dr.sentinelOutput;
    const occupiedBeds = Array.from(hs.beds.values()).filter((b) => b.patientId !== null).length;
    const prevWeather = rows.length ? rows[rows.length - 1]!.weather : 0;
    const wTotal = climate.extremeEvents.length;
    if (wTotal > prevWeather) weatherTicks.push(current.tick);
    rows.push({
      t: current.tick, co2: r3(climate.co2Concentration), anomaly: r3(climate.temperatureAnomaly),
      eventChance: r3(eventChance), weather: wTotal, admitMult: hs._admissionMultiplier,
      supplyPressure: r3(hs._supplyChainPressure), scenario: hs._scenario?.active?.type ?? null,
      occ: so ? r3(so.occupancyRate) : 0, icu: so ? r3(so.icuOccupancyRate) : 0,
      mort: so ? so.mortalityPressure : 0, supplyStress: so ? r3(so.supplyStress) : 0, occupiedBeds,
    });
  }
  const snap = snapshot(current);
  const hashOf = (id: string) => {
    const s = snap.sectors.find((x) => x.id === id);
    return s ? hashState(s.state) : "missing";
  };
  return {
    arm, co2Initial: co2, weatherTicks, weatherTotal: weatherTicks.length,
    adapterEventCount, firstWeatherTick: weatherTicks[0] ?? null,
    rows, final: (current.sectors.get(`deers-rock-${TARGET.id}`)!.state as DeersRockSectorState).sentinelOutput!,
    finalHash: hashState(snap.sectors),
    bHash: hashOf("deers-rock-sentinel-B"),
    cHash: hashOf("deers-rock-sentinel-C"),
  };
}

// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../../../experiment-results/vultr-sensitivity");
mkdirSync(outDir, { recursive: true });

const t0 = Date.now();
const results: Array<Record<string, unknown>> = [];
for (const seed of SEEDS) {
  const c = runArm(seed, CONTROL_CO2, "control");
  const i = runArm(seed, INTERVENTION_CO2, "intervention");
  const delta = {
    occupancyRate: r3(i.final.occupancyRate - c.final.occupancyRate),
    icuOccupancyRate: r3(i.final.icuOccupancyRate - c.final.icuOccupancyRate),
    mortalityPressure: i.final.mortalityPressure - c.final.mortalityPressure,
    supplyStress: r3(i.final.supplyStress - c.final.supplyStress),
  };
  // signal-loss localization: last link where arms differ
  const ctlWeather = c.weatherTotal, intWeather = i.weatherTotal;
  const lastDiffLink = ctlWeather !== intWeather ? "L2_event"
    : (c.rows.at(-1)!.admitMult !== i.rows.at(-1)!.admitMult) ? "L3_adapter"
    : (c.rows.at(-1)!.supplyPressure !== i.rows.at(-1)!.supplyPressure) ? "L3_adapter"
    : (delta.supplyStress !== 0 || delta.occupancyRate !== 0 || delta.icuOccupancyRate !== 0 || delta.mortalityPressure !== 0) ? "L5_observable"
    : "L1_macro_only";
  results.push({
    seed, deltas: delta, lastDiffLink,
    isolation: { sentinelBIdentical: c.bHash === i.bHash, sentinelCIdentical: c.cHash === i.cHash },
    ...(FULL_TRACE ? { controlRows: c.rows, interventionRows: i.rows } : {}),
    control: { weatherTotal: c.weatherTotal, adapterEventCount: c.adapterEventCount, firstWeatherTick: c.firstWeatherTick, final: c.final, finalHash: c.finalHash, lastRow: c.rows.at(-1) },
    intervention: { weatherTotal: i.weatherTotal, adapterEventCount: i.adapterEventCount, firstWeatherTick: i.firstWeatherTick, final: i.final, finalHash: i.finalHash, lastRow: i.rows.at(-1) },
  });
  console.log(`seed ${seed}: weather c=${c.weatherTotal} i=${i.weatherTotal} | Δsupply=${delta.supplyStress} Δocc=${delta.occupancyRate} Δicu=${delta.icuOccupancyRate} Δmort=${delta.mortalityPressure} | lastDiff=${lastDiffLink}`);
}

let keCommit = "unknown", drCommit = "unknown";
try { keCommit = execSync("git rev-parse HEAD", { cwd: join(__dirname, "../../..") }).toString().trim(); } catch { /* */ }
try { drCommit = execSync("git rev-parse HEAD", { cwd: "/root/Deers-Rock" }).toString().trim(); } catch { /* */ }

const out = {
  experimentId: EXPERIMENT_ID,
  label: LABEL,
  exploratory: true,
  canonical: false,
  disclaimer: "EXPLORATORY — NON-CANONICAL. Not manuscript evidence. Does not modify or supersede frozen Phase F.",
  executedAt: new Date().toISOString(),
  durationSec: r3((Date.now() - t0) / 1000),
  environment: { keCommit, drCommit, node: process.version, platform: process.platform, arch: process.arch, host: process.env.HOSTNAME ?? "unknown" },
  parameters: { horizon: HORIZON, ticksPerDay: TICKS_PER_DAY, controlCo2: CONTROL_CO2, interventionCo2: INTERVENTION_CO2, annualEmissions: ANNUAL_EMISSIONS, noise: NOISE, gdpGrowth: GDP_GROWTH, seeds: SEEDS },
  results,
};
writeFileSync(join(outDir, `${LABEL}.json`), JSON.stringify(out, null, 2));
console.log(`\n[${LABEL}] done in ${out.durationSec}s -> experiment-results/vultr-sensitivity/${LABEL}.json`);
