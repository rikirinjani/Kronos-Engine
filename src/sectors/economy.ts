import type { Sector, SectorState, WorldContext, TickHandler } from "./types.js";
import { ECONOMY_EVENTS, GEOPOLITICS_EVENTS, CLIMATE_EVENTS, TECHNOLOGY_EVENTS, publishTyped } from "./events.js";

export interface EconomyNationState {
  gdp: number;
  gdpGrowthRate: number;
  inflationRate: number;
  tradeVolume: number;
  unemploymentRate: number;
  wars: string[];
}

export interface EconomyState extends SectorState {
  _sectorId: "economy";
  year: number;
  tickCount: number;
  nations: Record<string, EconomyNationState>;
  globalTradeVolume: number;
  globalInflation: number;
  marketIndex: number;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function createEconomySector(): Sector {
  const events = [ECONOMY_EVENTS.GDP_SHIFT, ECONOMY_EVENTS.INFLATION_CHANGE, ECONOMY_EVENTS.TRADE_SHIFT];

  const handlers: TickHandler[] = [
    {
      eventType: GEOPOLITICS_EVENTS.WAR_START,
      handle(event, state) {
        const s = state as EconomyState;
        const attackers = event.data.attackers as string[];
        const defenders = event.data.defenders as string[];
        const warId = event.data.warId as string;
        let newNations = { ...s.nations };

        for (const id of attackers) {
          const n = newNations[id];
          if (!n) continue;
          newNations[id] = {
            ...n,
            gdp: n.gdp * 1.03,
            tradeVolume: Math.max(0, n.tradeVolume - 10),
            gdpGrowthRate: n.gdpGrowthRate + 2.0,
            wars: [...n.wars, warId],
          };
        }

        for (const id of defenders) {
          const n = newNations[id];
          if (!n) continue;
          newNations[id] = {
            ...n,
            gdp: n.gdp * 0.85,
            tradeVolume: Math.max(0, n.tradeVolume - 50),
            gdpGrowthRate: n.gdpGrowthRate - 5.0,
            wars: [...n.wars, warId],
          };
        }

        return { ...s, nations: newNations };
      },
    },
    {
      eventType: GEOPOLITICS_EVENTS.WAR_CASUALTIES,
      handle(event, state) {
        const s = state as EconomyState;
        const casualtiesDelta = event.data.casualtiesDelta as number;
        const drain = casualtiesDelta * 100_000_000;
        let newNations = { ...s.nations };

        for (const n of Object.values(newNations)) {
          const warDrain = drain * (n.gdp / 1e13);
          n.gdp = Math.max(1e9, n.gdp - warDrain);
        }

        return { ...s, nations: newNations };
      },
    },
    {
      eventType: CLIMATE_EVENTS.EXTREME_WEATHER,
      handle(event, state) {
        const s = state as EconomyState;
        const severity = event.data.severity as number;
        const gdpHit = severity * 0.02;
        let newNations = { ...s.nations };

        for (const n of Object.values(newNations)) {
          n.gdp *= 1 - gdpHit;
        }

        return { ...s, nations: newNations };
      },
    },
    {
      eventType: TECHNOLOGY_EVENTS.INNOVATION,
      handle(event, state) {
        const s = state as EconomyState;
        const nationId = event.data.nationId as string;
        const n = s.nations[nationId];
        if (!n) return s;
        return {
          ...s,
          nations: {
            ...s.nations,
            [nationId]: { ...n, gdpGrowthRate: n.gdpGrowthRate + 0.5 },
          },
        };
      },
    },
  ];

  return {
    id: "economy",
    name: "Economy",
    cadence: 3,
    events,

    init(seed: number, config: Record<string, unknown>): EconomyState {
      const rawNations = config.nations as Record<string, { gdp?: number; gdpGrowthRate?: number; inflationRate?: number; tradeVolume?: number; unemploymentRate?: number }> | undefined;
      const year = (config.year as number) ?? 2026;

      const nations: Record<string, EconomyNationState> = {};
      if (rawNations) {
        for (const [id, n] of Object.entries(rawNations)) {
          nations[id] = {
            gdp: (n.gdp as number) ?? 1e12,
            gdpGrowthRate: (n.gdpGrowthRate as number) ?? 2.5,
            inflationRate: (n.inflationRate as number) ?? 2.0,
            tradeVolume: (n.tradeVolume as number) ?? 50,
            unemploymentRate: (n.unemploymentRate as number) ?? 5.0,
            wars: [],
          };
        }
      }

      return {
        _sectorId: "economy",
        year,
        tickCount: 0,
        nations,
        globalTradeVolume: 100,
        globalInflation: 3.0,
        marketIndex: 100,
      };
    },

    tick(state: SectorState, world: WorldContext): EconomyState {
      const s = state as EconomyState;
      const { rng, eventBus, tick } = world;

      s.year += 1;
      s.tickCount += 1;

      for (const [id, n] of Object.entries(s.nations)) {
        const growthNoise = (rng.next() - 0.5) * 2;
        const effectiveGrowth = n.gdpGrowthRate + growthNoise;
        const gdpGrowth = n.gdp * (effectiveGrowth / 100);
        const newGdp = Math.max(1e9, n.gdp + gdpGrowth);
        const inflDrift = (rng.next() - 0.5) * 0.8;
        const meanReversion = (2.0 - n.inflationRate) * 0.1;
        const newInflation = clamp(n.inflationRate + inflDrift + meanReversion, -2, 20);
        const tradeNoise = (rng.next() - 0.5) * 4;
        const newTrade = clamp(n.tradeVolume + tradeNoise, 0, 100);

        if (Math.abs(newGdp - n.gdp) > n.gdp * 0.005) {
          publishTyped(eventBus, { type: ECONOMY_EVENTS.GDP_SHIFT, source: "economy", data: { nationId: id, gdpDelta: newGdp - n.gdp, oldGdp: n.gdp, newGdp }, tick });
        }
        if (Math.abs(newInflation - n.inflationRate) >= 0.3) {
          publishTyped(eventBus, { type: ECONOMY_EVENTS.INFLATION_CHANGE, source: "economy", data: { nationId: id, oldRate: n.inflationRate, newRate: newInflation }, tick });
        }
        if (Math.abs(newTrade - n.tradeVolume) >= 3) {
          publishTyped(eventBus, { type: ECONOMY_EVENTS.TRADE_SHIFT, source: "economy", data: { nationId: id, oldVolume: n.tradeVolume, newVolume: newTrade }, tick });
        }

        s.nations[id] = {
          gdp: newGdp,
          gdpGrowthRate: n.gdpGrowthRate + (rng.next() - 0.5) * 0.3,
          inflationRate: newInflation,
          tradeVolume: newTrade,
          unemploymentRate: clamp(n.unemploymentRate + (rng.next() - 0.5) * 0.5, 2, 15),
          wars: [...n.wars],
        };
      }

      s.globalTradeVolume = Math.max(50, s.globalTradeVolume + (rng.next() - 0.5) * 5);
      s.globalInflation = clamp(s.globalInflation + (rng.next() - 0.5) * 0.5, 0, 15);
      s.marketIndex = Math.max(30, s.marketIndex + (rng.next() - 0.5) * 8);

      return s;
    },

    handlers,
  };
}
