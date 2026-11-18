export interface PopulationProjection {
  model: "un-medium" | "un-low" | "un-high" | "constant";
  overrides?: Record<string, { growthRate: number; fertilityRate?: number }>;
  globalGrowthRate?: number;
  regionalRates?: Record<string, number>;
}

export interface EconomyProjection {
  convergenceModel: "beta" | "gini" | "constant";
  convergenceRate: number;
  steadyStateGrowth: number;
  productivityMultiplier: number;
  tradeLiberalization: number;
  inflationTarget?: number;
}

export interface TechnologyProjection {
  adoptionCurve: "s-curve" | "linear" | "step";
  aiAdoption: { midpoint: number; steepness: number };
  biotechAdoption: { midpoint: number; steepness: number };
  cleanEnergyAdoption: { midpoint: number; steepness: number };
  rdSpendingGrowth: number;
}

export interface ClimateProjection {
  sspScenario: "SSP1-1.9" | "SSP2-4.5" | "SSP3-7.0" | "SSP5-8.5";
  emissionTrend: number;
  climateSensitivity: number;
  extremeWeatherMultiplier: number;
}

export interface GeopoliticsProjection {
  allianceDecayRate: number;
  conflictProbability: number;
  relationsDriftRate: number;
  unipolarDecay: number;
  regionalBlocStrength: number;
}

export interface HealthProjection {
  lifeExpectancyConvergence: number;
  pandemicFrequency: number;
  pandemicSeverity: number;
  universalCoverageSpread: number;
}

export interface EnergyProjection {
  renewableAdoptionRate: number;
  fossilFuelDeclineRate: number;
  energyIntensityDecline: number;
  carbonPrice: number;
}

export interface FutureEraConfig {
  label: string;
  scenario: "baseline" | "optimistic" | "pessimistic";
  startYear: number;
  endYear: number;
  tickScale: "year" | "decade";
  population: PopulationProjection;
  economy: EconomyProjection;
  technology: TechnologyProjection;
  climate: ClimateProjection;
  geopolitics: GeopoliticsProjection;
  health: HealthProjection;
  energy: EnergyProjection;
}

export interface FutureEraState {
  year: number;
  label: string;
  baseEra: string;
  config: FutureEraConfig;
}
