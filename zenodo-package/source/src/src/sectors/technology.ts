import type { Sector, SectorState, WorldContext, TickHandler } from "./types.js";
import { TECHNOLOGY_EVENTS, ECONOMY_EVENTS, publishTyped } from "./events.js";

export interface TechNationState {
  technologyLevel: number;
  rdSpending: number;
  researchOutput: number;
  innovationCount: number;
  patents: number;
}

export interface TechnologyState extends SectorState {
  _sectorId: "technology";
  year: number;
  tickCount: number;
  nations: Record<string, TechNationState>;
  globalTechLevel: number;
  recentInnovations: string[];
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

const INNOVATION_NAMES = [
  "quantum computing breakthrough",
  "fusion energy milestone",
  "general AI advancement",
  "mRNA platform expansion",
  "solid-state battery density increase",
  "autonomous systems maturation",
  "biological computing prototype",
  "carbon capture efficiency leap",
  "space launch cost reduction",
  "neural interface resolution improvement",
  "cryogenic energy storage scale-up",
  "vertical farming yield record",
];

function pickInnovation(rng: { next(): number }): string {
  return INNOVATION_NAMES[Math.floor(rng.next() * INNOVATION_NAMES.length)]!;
}

export function createTechnologySector(): Sector {
  const events = [TECHNOLOGY_EVENTS.INNOVATION, TECHNOLOGY_EVENTS.DIFFUSION];

  const handlers: TickHandler[] = [
    {
      eventType: ECONOMY_EVENTS.GDP_SHIFT,
      handle(event, state) {
        const s = state as TechnologyState;
        const nationId = event.data.nationId as string;
        const gdpDelta = event.data.gdpDelta as number;
        const n = s.nations[nationId];
        if (!n) return s;

        const rdAdjustment = gdpDelta * n.rdSpending * 0.5;
        const newOutput = Math.max(0, n.researchOutput + rdAdjustment);
        return {
          ...s,
          nations: {
            ...s.nations,
            [nationId]: { ...n, researchOutput: newOutput },
          },
        };
      },
    },
  ];

  return {
    id: "technology",
    name: "Technology",
    cadence: 5,
    events,

    init(seed: number, config: Record<string, unknown>): TechnologyState {
      const rawNations = config.nations as Record<string, { technologyLevel?: number; rdSpending?: number }> | undefined;
      const year = (config.year as number) ?? 2026;

      const nations: Record<string, TechNationState> = {};
      if (rawNations) {
        for (const [id, n] of Object.entries(rawNations)) {
          nations[id] = {
            technologyLevel: clamp(n.technologyLevel as number ?? 50, 0, 100),
            rdSpending: (n.rdSpending as number) ?? 0.02,
            researchOutput: 0,
            innovationCount: 0,
            patents: 0,
          };
        }
      }

      const levels = Object.values(nations).map((n) => n.technologyLevel);

      return {
        _sectorId: "technology",
        year,
        tickCount: 0,
        nations,
        globalTechLevel: levels.length > 0 ? levels.reduce((a, b) => a + b, 0) / levels.length : 50,
        recentInnovations: [],
      };
    },

    tick(state: SectorState, world: WorldContext): TechnologyState {
      const s = state as TechnologyState;
      const { rng, eventBus, tick } = world;
      const innovations: string[] = [];

      s.year += 1;
      s.tickCount += 1;

      for (const [id, n] of Object.entries(s.nations)) {
        const rdEfficiency = 1 + rng.next() * 0.5;
        const baseOutput = n.rdSpending * n.technologyLevel * rdEfficiency * 10;
        const newResearch = n.researchOutput + baseOutput / 1e12;
        const rdBump = newResearch * 0.001;
        const techLevel = clamp(n.technologyLevel + rdBump, 0, 100);
        const patentGain = Math.floor(baseOutput * 10);
        const patents = n.patents + patentGain;
        let innovationCount = n.innovationCount;

        if (rng.next() < techLevel * 0.003) {
          innovationCount += 1;
          const innovation = pickInnovation(rng);
          innovations.push(`${id}: ${innovation}`);
          publishTyped(eventBus, { type: TECHNOLOGY_EVENTS.INNOVATION, source: "technology", data: { nationId: id, innovation, techLevel, year: s.year }, tick });
        }

        s.nations[id] = {
          technologyLevel: techLevel,
          rdSpending: clamp(n.rdSpending + (rng.next() - 0.5) * 0.002, 0.001, 0.1),
          researchOutput: newResearch * 0.9,
          innovationCount,
          patents,
        };
      }

      const techLeaderId = Object.entries(s.nations).sort(([, a], [, b]) => b.technologyLevel - a.technologyLevel)[0]?.[0];
      for (const [id, n] of Object.entries(s.nations)) {
        if (!techLeaderId || id === techLeaderId) continue;
        const leader = s.nations[techLeaderId]!;
        const gap = leader.technologyLevel - n.technologyLevel;
        if (gap > 0) {
          const diffusionRate = 0.02 + rng.next() * 0.03;
          const catchup = gap * diffusionRate;
          if (catchup >= 0.1) {
            n.technologyLevel = clamp(n.technologyLevel + catchup, 0, 100);
            publishTyped(eventBus, { type: TECHNOLOGY_EVENTS.DIFFUSION, source: "technology", data: { fromNation: techLeaderId, toNation: id, amount: catchup, year: s.year }, tick });
          }
        }
        n.rdSpending = clamp(n.rdSpending, 0.001, 0.1);
      }

      const levels = Object.values(s.nations).map((n) => n.technologyLevel);
      s.globalTechLevel = levels.length > 0 ? levels.reduce((a, b) => a + b, 0) / levels.length : 50;
      s.recentInnovations = innovations;
      return s;
    },

    handlers,
  };
}
