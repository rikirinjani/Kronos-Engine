import { readFileSync } from "node:fs";
import type { Sector } from "../sectors/types.js";
import type { StrategicWorldState, Nation } from "../timeline/history-types.js";
import { createWorld, run, snapshot } from "./world-engine.js";
import { createUniverse } from "./universe.js";
import type { WorldSnapshot } from "./world-engine.js";
import type { UniverseID } from "./universe.js";

interface EraFile {
  meta: { era: string; label: string; seedPrefix: string };
  states: Record<string, StrategicWorldState>;
}

export interface RunOptions {
  ticks: number;
  sectors: Sector[];
  seed?: number;
  universe?: UniverseID;
  configOverrides?: Record<string, Record<string, unknown>>;
}

export interface EraRunResult {
  snapshot: WorldSnapshot;
  state: StrategicWorldState;
  rewindPointId: string;
  tick: number;
}

function co2ForEra(era: string): number {
  const map: Record<string, number> = { ancient: 280, medieval: 280, "early-modern": 280, industrial: 310, modern: 360, contemporary: 420 };
  return map[era] ?? 350;
}

function emissionsForEra(era: string): number {
  const map: Record<string, number> = { ancient: 0, medieval: 0.1, "early-modern": 0.5, industrial: 5, modern: 25, contemporary: 37 };
  return map[era] ?? 10;
}

function gdpGrowthForYear(year: number): number {
  if (year < 1800) return 0.5; if (year < 1900) return 1.5; if (year < 1950) return 2.0; if (year < 2000) return 3.0; return 2.5;
}

function inflationForYear(year: number): number {
  if (year < 1900) return 0.5; if (year < 1950) return 2.0; if (year < 2000) return 4.0; return 3.0;
}

function rdForTech(tech: number): number {
  if (tech >= 80) return 0.035; if (tech >= 60) return 0.025; if (tech >= 40) return 0.015; return 0.008;
}

function tradeVolForGovt(govt: string): number {
  if (govt === "democracy") return 60; if (govt === "autocracy") return 40; return 30;
}

export function loadEraAndRun(
  eraPath: string,
  rewindPointId: string,
  options: RunOptions,
): EraRunResult {
  const content = readFileSync(eraPath, "utf-8");
  const eraFile: EraFile = JSON.parse(content);
  const era = eraFile.meta.era;
  const state = eraFile.states[rewindPointId];
  if (!state) throw new Error(`Rewind point "${rewindPointId}" not found in ${eraPath}`);

  const year = state.year;
  const configs: Record<string, Record<string, unknown>> = {};

  for (const sector of options.sectors) {
    switch (sector.id) {
      case "geopolitics":
        configs.geopolitics = {
          year, nations: state.nations, wars: state.wars, alliances: state.alliances,
          globalState: state.globalState ?? {
            totalPopulation: state.nations.reduce((s: number, n: Nation) => s + n.population, 0),
            avgTechnologyLevel: Math.round(state.nations.reduce((s: number, n: Nation) => s + n.technologyLevel, 0) / state.nations.length),
            avgHealthOutcome: Math.round(state.nations.reduce((s: number, n: Nation) => s + n.healthMetrics.lifeExpectancy, 0) / state.nations.length),
            co2Emissions: 0, tradeVolume: 50,
          },
        } as unknown as Record<string, unknown>;
        break;
      case "climate":
        configs.climate = { year, co2Concentration: co2ForEra(era), annualEmissions: emissionsForEra(era) } as unknown as Record<string, unknown>;
        break;
      case "economy": {
        const econNations: Record<string, Record<string, unknown>> = {};
        for (const n of state.nations) econNations[n.id] = { gdp: n.gdp, gdpGrowthRate: gdpGrowthForYear(year), inflationRate: inflationForYear(year), tradeVolume: tradeVolForGovt(n.government), unemploymentRate: 5.0 };
        configs.economy = { year, nations: econNations } as unknown as Record<string, unknown>;
        break;
      }
      case "technology": {
        const techNations: Record<string, Record<string, unknown>> = {};
        for (const n of state.nations) techNations[n.id] = { technologyLevel: n.technologyLevel, rdSpending: rdForTech(n.technologyLevel) };
        configs.technology = { year, nations: techNations } as unknown as Record<string, unknown>;
        break;
      }
      case "energy": {
        const eneNations: Record<string, Record<string, unknown>> = {};
        for (const n of state.nations) {
          const t = n.technologyLevel;
          eneNations[n.id] = { energyMix: { oil: 25, gas: 15, coal: 45, nuclear: 0, renewable: 5 }, totalConsumption: 20 + (t / 100) * 80, energyPrice: 80 + (1 - t / 100) * 20, energySecurity: 30 + (t / 100) * 40, co2Intensity: 0.6 - (t / 100) * 0.2 };
        }
        configs.energy = { year, nations: eneNations } as unknown as Record<string, unknown>;
        break;
      }
      case "demographics": {
        const demoNations: Record<string, Record<string, unknown>> = {};
        for (const n of state.nations) {
          const le = n.healthMetrics.lifeExpectancy;
          demoNations[n.id] = { population: n.population, birthRate: 20 + (1 - le / 80) * 15, deathRate: 8 + (1 - le / 80) * 15, medianAge: 20 + (le / 80) * 20, dependencyRatio: 60 - (n.technologyLevel / 100) * 20, laborForceParticipation: 45 + (n.technologyLevel / 100) * 20, netMigration: 0 };
        }
        configs.demographics = { year, nations: demoNations } as unknown as Record<string, unknown>;
        break;
      }
      default:
        configs[sector.id] = options.configOverrides?.[sector.id] ?? {};
    }
  }

  if (options.configOverrides) {
    for (const [id, overrides] of Object.entries(options.configOverrides)) {
      if (configs[id]) configs[id] = { ...configs[id], ...overrides };
    }
  }

  const seed = options.seed ?? 42;
  const universe = options.universe ?? createUniverse(seed);
  const world = createWorld(options.sectors, configs, { seed, universe });
  const result = run(world, options.ticks);
  const snap = snapshot(result);

  return { snapshot: snap, state, rewindPointId, tick: result.tick };
}
