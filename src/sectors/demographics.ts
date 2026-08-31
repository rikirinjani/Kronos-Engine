import type { Sector, SectorState, WorldContext, TickHandler } from "./types.js";
import { DEMOGRAPHICS_EVENTS, GEOPOLITICS_EVENTS, ECONOMY_EVENTS, publishTyped } from "./events.js";

export interface DemographicsNationState {
  population: number;
  birthRate: number;
  deathRate: number;
  medianAge: number;
  dependencyRatio: number;
  laborForceParticipation: number;
  laborForce: number;
  netMigration: number;
  wars: string[];
}

export interface DemographicsState extends SectorState {
  _sectorId: "demographics";
  year: number;
  tickCount: number;
  nations: Record<string, DemographicsNationState>;
  globalPopulation: number;
  globalMedianAge: number;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function createDemographicsSector(): Sector {
  const events = [DEMOGRAPHICS_EVENTS.POPULATION_SHIFT, DEMOGRAPHICS_EVENTS.MIGRATION, DEMOGRAPHICS_EVENTS.LABOR_FORCE_CHANGE, DEMOGRAPHICS_EVENTS.AGING_SHIFT];

  const handlers: TickHandler[] = [
    {
      eventType: GEOPOLITICS_EVENTS.WAR_START,
      handle(event, state) {
        const s = state as DemographicsState;
        const attackers = event.data.attackers as string[];
        const defenders = event.data.defenders as string[];
        const affected = [...attackers, ...defenders];
        let newNations = { ...s.nations };

        for (const id of affected) {
          const n = newNations[id];
          if (!n) continue;
          const warDeaths = n.population * 0.001;
          newNations[id] = {
            ...n,
            population: Math.max(1e5, n.population - warDeaths),
            deathRate: clamp(n.deathRate + 0.5, 0, 30),
            birthRate: clamp(n.birthRate - 0.3, 0, 30),
            netMigration: n.netMigration - 5000,
            wars: [...n.wars],
          };
        }

        return { ...s, nations: newNations };
      },
    },
    {
      eventType: ECONOMY_EVENTS.GDP_SHIFT,
      handle(event, state) {
        const s = state as DemographicsState;
        const nationId = event.data.nationId as string;
        const n = s.nations[nationId];
        if (!n) return s;
        const gdpDelta = event.data.gdpDelta as number;
        const growthFactor = gdpDelta > 0 ? 1.01 : 0.99;
        let newNations = { ...s.nations };
        newNations[nationId] = {
          ...n,
          birthRate: clamp(n.birthRate * (growthFactor > 1 ? 1.005 : 0.995), 0, 30),
          netMigration: n.netMigration + (gdpDelta > 0 ? 2000 : -2000),
          wars: [...n.wars],
        };
        return { ...s, nations: newNations };
      },
    },
  ];

  return {
    id: "demographics",
    name: "Demographics",
    cadence: 10,
    events,

    init(seed: number, config: Record<string, unknown>): DemographicsState {
      const rawNations = config.nations as Record<string, { population?: number; birthRate?: number; deathRate?: number; medianAge?: number; dependencyRatio?: number; laborForceParticipation?: number; netMigration?: number }> | undefined;
      const year = (config.year as number) ?? 2026;

      const nations: Record<string, DemographicsNationState> = {};
      if (rawNations) {
        for (const [id, n] of Object.entries(rawNations)) {
          nations[id] = {
            population: (n.population as number) ?? 10_000_000,
            birthRate: (n.birthRate as number) ?? 12,
            deathRate: (n.deathRate as number) ?? 8,
            medianAge: (n.medianAge as number) ?? 35,
            dependencyRatio: (n.dependencyRatio as number) ?? 50,
            laborForceParticipation: (n.laborForceParticipation as number) ?? 65,
            laborForce: ((n.population as number) ?? 10_000_000) * ((n.laborForceParticipation as number) ?? 65) / 100,
            netMigration: (n.netMigration as number) ?? 0,
            wars: [],
          };
        }
      }

      let totalPop = 0;
      let totalAgeWeighted = 0;
      for (const n of Object.values(nations)) {
        totalPop += n.population;
        totalAgeWeighted += n.population * n.medianAge;
      }

      return {
        _sectorId: "demographics",
        year,
        tickCount: 0,
        nations,
        globalPopulation: totalPop,
        globalMedianAge: totalPop > 0 ? totalAgeWeighted / totalPop : 35,
      };
    },

    tick(state: SectorState, world: WorldContext): DemographicsState {
      const s = state as DemographicsState;
      const { rng, eventBus, tick } = world;
      let year = s.year;
      const newNations: Record<string, DemographicsNationState> = {};

      year += 1;

      for (const [id, n] of Object.entries(s.nations)) {
        const birthNoise = (rng.next() - 0.5) * 0.4;
        const deathNoise = (rng.next() - 0.5) * 0.3;
        let newBirthRate = clamp(n.birthRate + birthNoise, 0, 30);
        let newDeathRate = clamp(n.deathRate + deathNoise, 0, 30);

        const births = n.population * (newBirthRate / 1000);
        const deaths = n.population * (newDeathRate / 1000);
        const migrNet = n.netMigration + (rng.next() - 0.5) * 10000;
        let newPopulation = Math.max(1e5, n.population + births - deaths + migrNet);

        const ageDrift = (rng.next() - 0.5) * 0.15;
        let newMedianAge = clamp(n.medianAge + ageDrift + 0.05, 15, 55);

        const depDrift = (rng.next() - 0.5) * 0.5;
        let newDepRatio = clamp(n.dependencyRatio + depDrift, 20, 100);

        const partDrift = (rng.next() - 0.5) * 0.3;
        let newPartRate = clamp(n.laborForceParticipation + partDrift - ageDrift * 0.1, 40, 85);

        let newLaborForce = newPopulation * (newPartRate / 100);

        if (Math.abs(newPopulation - n.population) > n.population * 0.002) {
          publishTyped(eventBus, {
            type: DEMOGRAPHICS_EVENTS.POPULATION_SHIFT,
            source: "demographics",
            data: { nationId: id, oldPopulation: n.population, newPopulation, birthRate: newBirthRate, deathRate: newDeathRate },
            tick,
          });
        }

        if (Math.abs(newMedianAge - n.medianAge) >= 0.3) {
          publishTyped(eventBus, {
            type: DEMOGRAPHICS_EVENTS.AGING_SHIFT,
            source: "demographics",
            data: { nationId: id, oldMedianAge: n.medianAge, newMedianAge, oldDependencyRatio: n.dependencyRatio, newDependencyRatio: newDepRatio },
            tick,
          });
        }

        if (Math.abs(newLaborForce - n.laborForce) > n.laborForce * 0.005) {
          publishTyped(eventBus, {
            type: DEMOGRAPHICS_EVENTS.LABOR_FORCE_CHANGE,
            source: "demographics",
            data: { nationId: id, oldLaborForce: n.laborForce, newLaborForce, participationRate: newPartRate },
            tick,
          });
        }

        newNations[id] = {
          population: Math.round(newPopulation),
          birthRate: newBirthRate,
          deathRate: newDeathRate,
          medianAge: newMedianAge,
          dependencyRatio: newDepRatio,
          laborForceParticipation: newPartRate,
          laborForce: Math.round(newLaborForce),
          netMigration: Math.round(migrNet),
          wars: [...n.wars],
        };
      }

      let totalPop = 0;
      let totalAgeWeighted = 0;
      for (const n of Object.values(newNations)) {
        totalPop += n.population;
        totalAgeWeighted += n.population * n.medianAge;
      }

      return {
        ...s,
        year,
        tickCount: s.tickCount + 1,
        nations: newNations,
        globalPopulation: totalPop,
        globalMedianAge: totalPop > 0 ? totalAgeWeighted / totalPop : 35,
      };
    },

    handlers,
  };
}
