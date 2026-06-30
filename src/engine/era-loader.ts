import { readFileSync } from "node:fs";
import type { StrategicWorldState, Nation, War, Alliance, GlobalAggregate } from "../timeline/history-types.js";
import type { FutureEraConfig, FutureEraState } from "../timeline/future-types.js";

interface EraFile {
  meta: { era: string; label: string; seedPrefix: string };
  states: Record<string, StrategicWorldState>;
}

interface FutureEraFile {
  meta: { era: string; label: string; seedPrefix: string };
  states: Record<string, FutureEraState>;
}

function extractYear(name: string): number {
  const m = name.match(/\d{4}/);
  return m ? parseInt(m[0], 10) : 2026;
}

function co2ConcentrationFor(era: string): number {
  const defaults: Record<string, number> = {
    ancient: 280, medieval: 280, "early-modern": 280,
    industrial: 310, modern: 360, contemporary: 420,
  };
  return defaults[era] ?? 350;
}

function annualEmissionsFor(era: string): number {
  const defaults: Record<string, number> = {
    ancient: 0, medieval: 0.1, "early-modern": 0.5,
    industrial: 5, modern: 25, contemporary: 37,
  };
  return defaults[era] ?? 10;
}

function rdSpendingFor(techLevel: number): number {
  if (techLevel >= 80) return 0.035;
  if (techLevel >= 60) return 0.025;
  if (techLevel >= 40) return 0.015;
  return 0.008;
}

function gdpGrowthRateFor(year: number): number {
  if (year < 1800) return 0.5;
  if (year < 1900) return 1.5;
  if (year < 1950) return 2.0;
  if (year < 2000) return 3.0;
  return 2.5;
}

function inflationRateFor(year: number): number {
  if (year < 1900) return 0.5;
  if (year < 1950) return 2.0;
  if (year < 2000) return 4.0;
  return 3.0;
}

function tradeVolumeFor(government: string): number {
  if (government === "democracy") return 60;
  if (government === "autocracy") return 40;
  return 30;
}

const CLIMATE_ERA_KEY = "era" as const;

export function loadEraConfig(eraJsonPath: string, rewindPointId: string): Record<string, Record<string, unknown>> {
  const content = readFileSync(eraJsonPath, "utf-8");
  const parsed = JSON.parse(content) as EraFile | FutureEraFile;
  const meta = parsed.meta;

  if (meta.era === "future") {
    const futureFile = parsed as unknown as FutureEraFile;
    const state = futureFile.states[rewindPointId] as FutureEraState;
    if (!state) throw new Error(`Future rewind point "${rewindPointId}" not found in ${eraJsonPath}`);

    const baseEraPath = eraJsonPath.replace(/era-[a-z]+\.json$/, "era-contemporary.json");
    const baseConfigs = loadEraConfig(baseEraPath, state.baseEra);
    return buildSectorConfigsWithFuture(state, baseConfigs, meta.era);
  }

  const eraFile = parsed as EraFile;
  const state = eraFile.states[rewindPointId] as StrategicWorldState;
  if (!state) throw new Error(`Rewind point "${rewindPointId}" not found in ${eraJsonPath}`);

  return buildSectorConfigs(state, meta.era);
}

function buildSectorConfigsWithFuture(
  futureState: FutureEraState,
  baseConfigs: Record<string, Record<string, unknown>>,
  era: string,
): Record<string, Record<string, unknown>> {
  const cfg = futureState.config;
  const year = futureState.year;

  const result: Record<string, Record<string, unknown>> = {};

  for (const [key, base] of Object.entries(baseConfigs)) {
    result[key] = { ...base, year };
  }

  if (result.climate) {
    Object.assign(result.climate, {
      co2Concentration: co2ConcentrationFor(era),
      annualEmissions: cfg.climate.emissionTrend > 0 ? Math.abs(cfg.climate.emissionTrend) * 20 : 5 + cfg.climate.emissionTrend,
    });
  }

  if (result.economy) {
    const econ = result.economy as Record<string, unknown>;
    const nations = econ.nations as Record<string, Record<string, unknown>> | undefined;
    if (nations) {
      for (const n of Object.values(nations)) {
        n.gdpGrowthRate = cfg.economy.steadyStateGrowth;
        n.inflationRate = cfg.economy.inflationTarget ?? 2.0;
      }
    }
  }

  if (result.technology) {
    const tech = result.technology as Record<string, unknown>;
    const nations = tech.nations as Record<string, Record<string, unknown>> | undefined;
    if (nations) {
      for (const n of Object.values(nations)) {
        n.rdSpending = (n.rdSpending as number) * (1 + cfg.technology.rdSpendingGrowth / 100);
      }
    }
  }

  return result;
}

export function buildSectorConfigs(state: StrategicWorldState, era: string): Record<string, Record<string, unknown>> {
  const year = state.year;

  const geopoliticsConfig = {
    year,
    nations: state.nations.map((n: Nation) => ({
      id: n.id,
      name: n.name,
      region: n.region,
      population: n.population,
      gdp: n.gdp,
      government: n.government,
      technologyLevel: n.technologyLevel,
      militaryPower: n.militaryPower,
      healthMetrics: { ...n.healthMetrics },
      alliances: [...n.alliances],
      wars: [...n.wars],
      relations: { ...n.relations },
    })),
    wars: state.wars.map((w: War) => ({
      id: w.id,
      name: w.name,
      parties: { attackers: [...w.parties.attackers], defenders: [...w.parties.defenders] },
      startYear: w.startYear,
      status: w.status,
      casualties: w.casualties,
    })),
    alliances: state.alliances.map((a: Alliance) => ({
      id: a.id,
      name: a.name,
      members: [...a.members],
      formed: a.formed,
      type: a.type,
      strength: a.strength,
    })),
    globalState: state.globalState ? {
      totalPopulation: state.globalState.totalPopulation,
      avgTechnologyLevel: state.globalState.avgTechnologyLevel,
      avgHealthOutcome: state.globalState.avgHealthOutcome,
      co2Emissions: state.globalState.co2Emissions,
      tradeVolume: state.globalState.tradeVolume,
    } : {
      totalPopulation: state.nations.reduce((s: number, n: Nation) => s + n.population, 0),
      avgTechnologyLevel: Math.round(state.nations.reduce((s: number, n: Nation) => s + n.technologyLevel, 0) / state.nations.length),
      avgHealthOutcome: Math.round(state.nations.reduce((s: number, n: Nation) => s + n.healthMetrics.lifeExpectancy, 0) / state.nations.length),
      co2Emissions: 0,
      tradeVolume: 50,
    },
  };

  const climateConfig = {
    year,
    co2Concentration: co2ConcentrationFor(era),
    annualEmissions: annualEmissionsFor(era),
  };

  const economyNations: Record<string, {
    gdp: number; gdpGrowthRate: number; inflationRate: number;
    tradeVolume: number; unemploymentRate: number;
  }> = {};
  for (const n of state.nations) {
    economyNations[n.id] = {
      gdp: n.gdp,
      gdpGrowthRate: gdpGrowthRateFor(year),
      inflationRate: inflationRateFor(year),
      tradeVolume: tradeVolumeFor(n.government),
      unemploymentRate: 5.0,
    };
  }

  const economyConfig = { year, nations: economyNations };

  const techNations: Record<string, { technologyLevel: number; rdSpending: number }> = {};
  for (const n of state.nations) {
    techNations[n.id] = {
      technologyLevel: n.technologyLevel,
      rdSpending: rdSpendingFor(n.technologyLevel),
    };
  }

  const technologyConfig = { year, nations: techNations };

  return {
    geopolitics: geopoliticsConfig as unknown as Record<string, unknown>,
    climate: climateConfig as unknown as Record<string, unknown>,
    economy: economyConfig as unknown as Record<string, unknown>,
    technology: technologyConfig as unknown as Record<string, unknown>,
  };
}
