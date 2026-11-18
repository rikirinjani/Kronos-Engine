import type { WorldEvent, EventBus } from "./types.js";

export const GEOPOLITICS_EVENTS = {
  RELATION_SHIFT: "geopolitics.relation_shift",
  WAR_START: "geopolitics.war_start",
  WAR_END: "geopolitics.war_end",
  WAR_CASUALTIES: "geopolitics.war_casualties",
} as const;

export const CLIMATE_EVENTS = {
  TEMP_SHIFT: "climate.temp_shift",
  EXTREME_WEATHER: "climate.extreme_weather",
  EMISSIONS_CHANGE: "climate.emissions_change",
} as const;

export const ECONOMY_EVENTS = {
  GDP_SHIFT: "economy.gdp_shift",
  INFLATION_CHANGE: "economy.inflation_change",
  TRADE_SHIFT: "economy.trade_shift",
} as const;

export const TECHNOLOGY_EVENTS = {
  INNOVATION: "technology.innovation",
  DIFFUSION: "technology.diffusion",
} as const;

export const ENERGY_EVENTS = {
  PRICE_SHIFT: "energy.price_shift",
  MIX_SHIFT: "energy.mix_shift",
  SUPPLY_SHOCK: "energy.supply_shock",
} as const;

export const DEMOGRAPHICS_EVENTS = {
  POPULATION_SHIFT: "demographics.population_shift",
  MIGRATION: "demographics.migration",
  LABOR_FORCE_CHANGE: "demographics.labor_force_change",
  AGING_SHIFT: "demographics.aging_shift",
} as const;

export interface RelationShiftEvent {
  nationId: string;
  otherId: string;
  oldVal: number;
  newVal: number;
}

export interface WarStartEvent {
  warId: string;
  name: string;
  attackers: string[];
  defenders: string[];
  year: number;
}

export interface WarEndEvent {
  warId: string;
  name: string;
  totalCasualties: number;
}

export interface WarCasualtiesEvent {
  warId: string;
  casualtiesDelta: number;
  total: number;
}

export interface TempShiftEvent {
  oldAnomaly: number;
  newAnomaly: number;
  co2Concentration: number;
}

export interface ExtremeWeatherEvent {
  weatherType: string;
  region: string;
  severity: number;
  year: number;
  description: string;
}

export interface EmissionsChangeEvent {
  oldEmissions: number;
  newEmissions: number;
}

export interface GdpShiftEvent {
  nationId: string;
  gdpDelta: number;
  oldGdp: number;
  newGdp: number;
}

export interface InflationChangeEvent {
  nationId: string;
  oldRate: number;
  newRate: number;
}

export interface TradeShiftEvent {
  nationId: string;
  oldVolume: number;
  newVolume: number;
}

export interface InnovationEvent {
  nationId: string;
  innovation: string;
  techLevel: number;
  year: number;
}

export interface TechDiffusionEvent {
  fromNation: string;
  toNation: string;
  amount: number;
  year: number;
}

export interface EnergyPriceShiftEvent {
  nationId: string;
  oldPrice: number;
  newPrice: number;
  cause: string;
}

export interface EnergyMixShiftEvent {
  nationId: string;
  oldRenewable: number;
  newRenewable: number;
  year: number;
}

export interface EnergySupplyShockEvent {
  region: string;
  severity: number;
  cause: string;
  year: number;
}

export interface PopulationShiftEvent {
  nationId: string;
  oldPopulation: number;
  newPopulation: number;
  birthRate: number;
  deathRate: number;
}

export interface MigrationEvent {
  fromNation: string;
  toNation: string;
  count: number;
  year: number;
  cause: string;
}

export interface LaborForceChangeEvent {
  nationId: string;
  oldLaborForce: number;
  newLaborForce: number;
  participationRate: number;
}

export interface AgingShiftEvent {
  nationId: string;
  oldMedianAge: number;
  newMedianAge: number;
  oldDependencyRatio: number;
  newDependencyRatio: number;
}

export type EventPayloadMap = {
  [GEOPOLITICS_EVENTS.RELATION_SHIFT]: RelationShiftEvent;
  [GEOPOLITICS_EVENTS.WAR_START]: WarStartEvent;
  [GEOPOLITICS_EVENTS.WAR_END]: WarEndEvent;
  [GEOPOLITICS_EVENTS.WAR_CASUALTIES]: WarCasualtiesEvent;
  [CLIMATE_EVENTS.TEMP_SHIFT]: TempShiftEvent;
  [CLIMATE_EVENTS.EXTREME_WEATHER]: ExtremeWeatherEvent;
  [CLIMATE_EVENTS.EMISSIONS_CHANGE]: EmissionsChangeEvent;
  [ECONOMY_EVENTS.GDP_SHIFT]: GdpShiftEvent;
  [ECONOMY_EVENTS.INFLATION_CHANGE]: InflationChangeEvent;
  [ECONOMY_EVENTS.TRADE_SHIFT]: TradeShiftEvent;
  [TECHNOLOGY_EVENTS.INNOVATION]: InnovationEvent;
  [TECHNOLOGY_EVENTS.DIFFUSION]: TechDiffusionEvent;
  [ENERGY_EVENTS.PRICE_SHIFT]: EnergyPriceShiftEvent;
  [ENERGY_EVENTS.MIX_SHIFT]: EnergyMixShiftEvent;
  [ENERGY_EVENTS.SUPPLY_SHOCK]: EnergySupplyShockEvent;
  [DEMOGRAPHICS_EVENTS.POPULATION_SHIFT]: PopulationShiftEvent;
  [DEMOGRAPHICS_EVENTS.MIGRATION]: MigrationEvent;
  [DEMOGRAPHICS_EVENTS.LABOR_FORCE_CHANGE]: LaborForceChangeEvent;
  [DEMOGRAPHICS_EVENTS.AGING_SHIFT]: AgingShiftEvent;
};

export type KnownEventType = keyof EventPayloadMap;

export interface TypedWorldEvent<T extends KnownEventType = KnownEventType> extends Omit<WorldEvent, "type" | "data"> {
  type: T;
  data: EventPayloadMap[T];
}

export const SECTOR_EVENTS = {
  geopolitics: Object.values(GEOPOLITICS_EVENTS),
  climate: Object.values(CLIMATE_EVENTS),
  economy: Object.values(ECONOMY_EVENTS),
  technology: Object.values(TECHNOLOGY_EVENTS),
  energy: Object.values(ENERGY_EVENTS),
  demographics: Object.values(DEMOGRAPHICS_EVENTS),
} as const;

export const EVENT_SUBSCRIPTIONS: Record<string, readonly string[]> = {
  geopolitics: [ECONOMY_EVENTS.GDP_SHIFT],
  climate: [ECONOMY_EVENTS.GDP_SHIFT, ENERGY_EVENTS.PRICE_SHIFT, ENERGY_EVENTS.MIX_SHIFT],
  economy: [GEOPOLITICS_EVENTS.WAR_START, GEOPOLITICS_EVENTS.WAR_CASUALTIES, CLIMATE_EVENTS.EXTREME_WEATHER, ENERGY_EVENTS.PRICE_SHIFT, DEMOGRAPHICS_EVENTS.LABOR_FORCE_CHANGE],
  technology: [ECONOMY_EVENTS.GDP_SHIFT, ENERGY_EVENTS.PRICE_SHIFT],
  energy: [GEOPOLITICS_EVENTS.WAR_START, CLIMATE_EVENTS.EXTREME_WEATHER, ECONOMY_EVENTS.GDP_SHIFT, TECHNOLOGY_EVENTS.INNOVATION],
  demographics: [ECONOMY_EVENTS.GDP_SHIFT, GEOPOLITICS_EVENTS.WAR_START],
};

export function publishTyped<T extends KnownEventType>(
  bus: EventBus,
  event: TypedWorldEvent<T>,
): void {
  bus.publish(event as unknown as WorldEvent);
}
