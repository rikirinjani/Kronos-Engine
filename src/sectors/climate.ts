import type { Sector, SectorState, WorldContext, TickHandler } from "./types.js";
import { CLIMATE_EVENTS, ECONOMY_EVENTS, publishTyped } from "./events.js";

export type ExtremeWeatherType = "heatwave" | "flood" | "drought" | "hurricane" | "wildfire";

export interface ExtremeWeatherEvent {
  type: ExtremeWeatherType;
  region: string;
  severity: number;
  year: number;
  description: string;
}

export interface ClimateState extends SectorState {
  _sectorId: "climate";
  year: number;
  tickCount: number;
  co2Concentration: number;
  annualEmissions: number;
  annualEmissionsNoise: number;
  temperatureAnomaly: number;
  extremeEvents: ExtremeWeatherEvent[];
  seaLevelRise: number;
}

const PRE_INDUSTRIAL_CO2 = 280;
const CLIMATE_SENSITIVITY = 3;
const AIRBORNE_FRACTION = 0.45;
const ATMOSPHERIC_MASS = 7.8;

function emissionsToConcentration(emissionsGt: number): number {
  return (emissionsGt * AIRBORNE_FRACTION) / ATMOSPHERIC_MASS;
}

function calcTemperatureAnomaly(co2: number): number {
  if (co2 <= PRE_INDUSTRIAL_CO2) return 0;
  return CLIMATE_SENSITIVITY * Math.log2(co2 / PRE_INDUSTRIAL_CO2);
}

const EVENT_TYPES: ExtremeWeatherType[] = ["heatwave", "flood", "drought", "hurricane", "wildfire"];

function pickWeatherType(rng: { next(): number }): ExtremeWeatherType {
  return EVENT_TYPES[Math.floor(rng.next() * EVENT_TYPES.length)]!;
}

function extractRegion(nationId: string): string {
  if (nationId === "IDN" || nationId === "SGP" || nationId === "MYS" || nationId === "PHL" || nationId === "THA" || nationId === "VNM") return "southeast-asia";
  if (nationId === "USA" || nationId === "CAN") return "north-america";
  if (nationId === "GBR" || nationId === "FRA" || nationId === "DEU") return "western-europe";
  if (nationId === "RUS") return "eastern-europe";
  if (nationId === "CHN" || nationId === "JPN" || nationId === "KOR") return "east-asia";
  if (nationId === "IND" || nationId === "PAK") return "south-asia";
  if (nationId === "AUS" || nationId === "NZL") return "oceania";
  if (nationId === "BRA" || nationId === "ARG") return "south-america";
  if (nationId === "ZAF" || nationId === "NGA") return "africa";
  if (nationId === "SAU" || nationId === "IRN") return "middle-east";
  return "global";
}

export function createClimateSector(): Sector {
  const events = [CLIMATE_EVENTS.TEMP_SHIFT, CLIMATE_EVENTS.EXTREME_WEATHER, CLIMATE_EVENTS.EMISSIONS_CHANGE];

  const handlers: TickHandler[] = [
    {
      eventType: ECONOMY_EVENTS.GDP_SHIFT,
      handle(event, state) {
        const s = state as ClimateState;
        const gdpDelta = event.data.gdpDelta as number;
        const emissionsFactor = 0.00005;
        const emissionsDelta = gdpDelta * emissionsFactor;
        return {
          ...s,
          annualEmissions: Math.max(0, s.annualEmissions + emissionsDelta),
        };
      },
    },
  ];

  return {
    id: "climate",
    name: "Climate",
    events,

    init(seed: number, config: Record<string, unknown>): ClimateState {
      const co2Concentration = (config.co2Concentration as number) ?? 420;
      const annualEmissions = (config.annualEmissions as number) ?? 37;
      const year = (config.year as number) ?? 2026;
      const annualEmissionsNoise = (config.annualEmissionsNoise as number) ?? 0.2;

      return {
        _sectorId: "climate",
        year,
        tickCount: 0,
        annualEmissionsNoise,
        co2Concentration,
        annualEmissions,
        temperatureAnomaly: calcTemperatureAnomaly(co2Concentration),
        extremeEvents: [],
        seaLevelRise: 0,
      };
    },

    tick(state: SectorState, world: WorldContext): ClimateState {
      const s = state as ClimateState;
      const { rng, eventBus, tick } = world;
      let year = s.year;
      let co2Conc = s.co2Concentration;
      let annualEm = s.annualEmissions;
      let seaLevel = s.seaLevelRise;
      const eventsThisTick: ExtremeWeatherEvent[] = [];

      year += 1;
      co2Conc += emissionsToConcentration(annualEm);
      annualEm += (rng.next() - 0.5) * s.annualEmissionsNoise;
      annualEm = Math.max(0, annualEm);

      const newAnomaly = calcTemperatureAnomaly(co2Conc);

      seaLevel += 0.5 + rng.next() * 3.5;

      if (Math.abs(newAnomaly - s.temperatureAnomaly) >= 0.01) {
        publishTyped(eventBus, {
          type: CLIMATE_EVENTS.TEMP_SHIFT,
          source: "climate",
          data: { oldAnomaly: s.temperatureAnomaly, newAnomaly, co2Concentration: co2Conc },
          tick,
        });
      }

      if (Math.abs(annualEm - s.annualEmissions) >= 1) {
        publishTyped(eventBus, {
          type: CLIMATE_EVENTS.EMISSIONS_CHANGE,
          source: "climate",
          data: { oldEmissions: s.annualEmissions, newEmissions: annualEm },
          tick,
        });
      }

      const baseEventChance = 0.1 + (newAnomaly - 1.2) * 0.05;
      const eventChance = Math.max(0.05, Math.min(0.5, baseEventChance));

      if (rng.next() < eventChance) {
        const weatherType = pickWeatherType(rng);
        const severity = Math.round((1 + rng.next() * 4 + newAnomaly * 0.5) * 10) / 10;
        const region = extractRegion("global");

        eventsThisTick.push({
          type: weatherType,
          region,
          severity,
          year,
          description: `${weatherType} (severity ${severity}) in ${region} at year ${year}`,
        });

        publishTyped(eventBus, {
          type: CLIMATE_EVENTS.EXTREME_WEATHER,
          source: "climate",
          data: { weatherType, region, severity, year, description: eventsThisTick[eventsThisTick.length - 1]!.description },
          tick,
        });
      }

      return {
        _sectorId: "climate",
        year,
        tickCount: s.tickCount + 1,
        annualEmissionsNoise: s.annualEmissionsNoise,
        co2Concentration: co2Conc,
        annualEmissions: annualEm,
        temperatureAnomaly: newAnomaly,
        extremeEvents: [...s.extremeEvents, ...eventsThisTick],
        seaLevelRise: seaLevel,
      };
    },

    handlers,
  };
}
