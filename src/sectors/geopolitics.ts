import type { Sector, SectorState, WorldContext, TickHandler, RNG } from "./types.js";
import { GEOPOLITICS_EVENTS, ECONOMY_EVENTS, publishTyped } from "./events.js";

export type Government = "democracy" | "autocracy" | "monarchy" | "theocracy" | "transitional";
export type AllianceType = "defense" | "economic" | "political";
export type WarStatus = "active" | "frozen" | "ended";

export interface Nation {
  id: string;
  name: string;
  region: string;
  population: number;
  gdp: number;
  government: Government;
  technologyLevel: number;
  militaryPower: number;
  healthMetrics: {
    lifeExpectancy: number;
    infantMortality: number;
    hospitalBedsPer1000: number;
    universalCoverage: boolean;
  };
  alliances: string[];
  wars: string[];
  relations: Record<string, number>;
}

export interface War {
  id: string;
  name: string;
  parties: { attackers: string[]; defenders: string[] };
  startYear: number;
  status: WarStatus;
  casualties: number;
}

export interface Alliance {
  id: string;
  name: string;
  members: string[];
  formed: number;
  type: AllianceType;
  strength: number;
}

export interface GlobalState {
  totalPopulation: number;
  avgTechnologyLevel: number;
  avgHealthOutcome: number;
  co2Emissions: number;
  tradeVolume: number;
}

export interface GeopoliticsState extends SectorState {
  _sectorId: "geopolitics";
  year: number;
  tickCount: number;
  nations: Record<string, Nation>;
  wars: Record<string, War>;
  alliances: Record<string, Alliance>;
  globalState: GlobalState;
  casualtyMultiplier: number;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function pickNation(rng: RNG, nations: Record<string, Nation>): Nation | null {
  const ids = Object.keys(nations);
  if (ids.length === 0) return null;
  const idx = Math.floor(rng.next() * ids.length);
  return nations[ids[idx]!]!;
}

function generateWarId(rng: RNG): string {
  const n = Math.floor(rng.next() * 90000) + 10000;
  return `W-${n}`;
}

function generateAllianceId(rng: RNG): string {
  const n = Math.floor(rng.next() * 90000) + 10000;
  return `A-${n}`;
}

export function createGeopoliticsSector(): Sector {
  const events = [GEOPOLITICS_EVENTS.RELATION_SHIFT, GEOPOLITICS_EVENTS.WAR_START, GEOPOLITICS_EVENTS.WAR_END, GEOPOLITICS_EVENTS.WAR_CASUALTIES];

  const handlers: TickHandler[] = [
    {
      eventType: ECONOMY_EVENTS.GDP_SHIFT,
      handle(event, state) {
        const s = state as GeopoliticsState;
        const nationId = event.data.nationId as string;
        const gdpDelta = event.data.gdpDelta as number;
        const nation = s.nations[nationId];
        if (!nation) return s;
        return {
          ...s,
          nations: {
            ...s.nations,
            [nationId]: { ...nation, gdp: Math.max(0, nation.gdp + gdpDelta) },
          },
        };
      },
    },
  ];

  return {
    id: "geopolitics",
    name: "Geopolitics",
    events,

    init(seed: number, config: Record<string, unknown>): GeopoliticsState {
      const nations = config.nations as Nation[] | undefined;
      const wars = config.wars as War[] | undefined;
      const alliances = config.alliances as Alliance[] | undefined;
      const globalState = config.globalState as GlobalState | undefined;
      const year = (config.year as number) ?? 2026;
      const casualtyMultiplier = (config.casualtyMultiplier as number) ?? 1;

      const nationMap: Record<string, Nation> = {};
      if (nations) {
        for (const n of nations) {
          nationMap[n.id] = { ...n };
        }
      }

      const warMap: Record<string, War> = {};
      if (wars) {
        for (const w of wars) {
          warMap[w.id] = { ...w };
        }
      }

      const allianceMap: Record<string, Alliance> = {};
      if (alliances) {
        for (const a of alliances) {
          allianceMap[a.id] = { ...a };
        }
      }

      return {
        _sectorId: "geopolitics",
        year,
        tickCount: 0,
        casualtyMultiplier,
        nations: nationMap,
        wars: warMap,
        alliances: allianceMap,
        globalState: globalState ?? {
          totalPopulation: 8_200_000_000,
          avgTechnologyLevel: 50,
          avgHealthOutcome: 73,
          co2Emissions: 37_000_000_000,
          tradeVolume: 100,
        },
      };
    },

    tick(state: SectorState, world: WorldContext): GeopoliticsState {
      const s = state as GeopoliticsState;
      const { rng, eventBus, tick } = world;
      const RELATION_DRIFT = 2;
      const PUBLISH_THRESHOLD = 1;
      const RELATION_THRESHOLD = -60;

      let newNations = { ...s.nations };
      let newWars = { ...s.wars };
      let newAlliances = { ...s.alliances };
      let year = s.year;

      year += 1;

      for (const nation of Object.values(newNations)) {
        for (const otherId of Object.keys(nation.relations)) {
          if (!newNations[otherId]) continue;
          const drift = (rng.next() - 0.5) * 2 * RELATION_DRIFT;
          const oldVal = nation.relations[otherId]!;
          const newVal = clamp(oldVal + drift, -100, 100);
          nation.relations[otherId] = newVal;

          if (Math.abs(newVal - oldVal) >= PUBLISH_THRESHOLD) {
            publishTyped(eventBus, {
              type: GEOPOLITICS_EVENTS.RELATION_SHIFT,
              source: "geopolitics",
              data: { nationId: nation.id, otherId, oldVal, newVal },
              tick,
            });
          }
        }
      }

      for (const war of Object.values(newWars)) {
        if (war.status !== "active") continue;
        const baseDelta = Math.floor(rng.next() * 500) + 50;
        const casualtiesDelta = Math.floor(baseDelta * s.casualtyMultiplier);
        war.casualties += casualtiesDelta;

        publishTyped(eventBus, {
          type: GEOPOLITICS_EVENTS.WAR_CASUALTIES,
          source: "geopolitics",
          data: { warId: war.id, casualtiesDelta, total: war.casualties },
          tick,
        });

        if (rng.next() < 0.05) {
          war.status = "ended";
          publishTyped(eventBus, {
            type: GEOPOLITICS_EVENTS.WAR_END,
            source: "geopolitics",
            data: { warId: war.id, name: war.name, totalCasualties: war.casualties },
            tick,
          });
        }
      }

      for (const nation of Object.values(newNations)) {
        const hasLowRelation = Object.values(nation.relations).some((v) => v < RELATION_THRESHOLD);
        if (hasLowRelation && rng.next() < 0.02) {
          const enemies = Object.entries(nation.relations)
            .filter(([, v]) => v < RELATION_THRESHOLD)
            .map(([id]) => id);
          const targetId = enemies[Math.floor(rng.next() * enemies.length)]!;
          const target = newNations[targetId];
          if (!target) continue;

          const warId = generateWarId(rng);
          newWars[warId] = {
            id: warId,
            name: `${nation.name}-${target.name} Conflict`,
            parties: { attackers: [nation.id], defenders: [target.id] },
            startYear: year,
            status: "active",
            casualties: 0,
          };
          nation.wars.push(warId);
          target.wars.push(warId);

          publishTyped(eventBus, {
            type: GEOPOLITICS_EVENTS.WAR_START,
            source: "geopolitics",
            data: { warId, name: newWars[warId]!.name, attackers: [nation.id], defenders: [target.id], year },
            tick,
          });
        }
      }

      return {
        ...s,
        year,
        tickCount: s.tickCount + 1,
        nations: newNations,
        wars: newWars,
        alliances: newAlliances,
      };
    },

    handlers,
  };
}
