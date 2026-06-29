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
} as const;

export const EVENT_SUBSCRIPTIONS: Record<string, readonly string[]> = {
  geopolitics: [ECONOMY_EVENTS.GDP_SHIFT],
  climate: [ECONOMY_EVENTS.GDP_SHIFT],
  economy: [GEOPOLITICS_EVENTS.WAR_START, GEOPOLITICS_EVENTS.WAR_CASUALTIES, CLIMATE_EVENTS.EXTREME_WEATHER],
  technology: [ECONOMY_EVENTS.GDP_SHIFT],
};

export function publishTyped<T extends KnownEventType>(
  bus: EventBus,
  event: TypedWorldEvent<T>,
): void {
  bus.publish(event as unknown as WorldEvent);
}
