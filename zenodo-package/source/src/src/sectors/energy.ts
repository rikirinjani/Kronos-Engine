import type { Sector, SectorState, WorldContext, TickHandler } from "./types.js";
import { ENERGY_EVENTS, GEOPOLITICS_EVENTS, CLIMATE_EVENTS, ECONOMY_EVENTS, TECHNOLOGY_EVENTS, publishTyped } from "./events.js";

export interface EnergyNationState {
  energyMix: { oil: number; gas: number; coal: number; nuclear: number; renewable: number };
  totalConsumption: number;
  energyPrice: number;
  energySecurity: number;
  co2Intensity: number;
  wars: string[];
}

export interface EnergyState extends SectorState {
  _sectorId: "energy";
  year: number;
  tickCount: number;
  nations: Record<string, EnergyNationState>;
  globalEnergyPrice: number;
  globalRenewableShare: number;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function createEnergySector(): Sector {
  const events = [ENERGY_EVENTS.PRICE_SHIFT, ENERGY_EVENTS.MIX_SHIFT, ENERGY_EVENTS.SUPPLY_SHOCK];

  const handlers: TickHandler[] = [
    {
      eventType: GEOPOLITICS_EVENTS.WAR_START,
      handle(event, state) {
        const s = state as EnergyState;
        const attackers = event.data.attackers as string[];
        const defenders = event.data.defenders as string[];
        const affected = [...attackers, ...defenders];
        let newNations = { ...s.nations };

        for (const id of affected) {
          const n = newNations[id];
          if (!n) continue;
          const supplyHit = n.energySecurity * 0.3;
          newNations[id] = {
            ...n,
            energySecurity: Math.max(0, n.energySecurity - supplyHit),
            energyPrice: n.energyPrice * 1.25,
            wars: [...n.wars],
          };
        }

        return { ...s, nations: newNations, globalEnergyPrice: s.globalEnergyPrice * 1.1 };
      },
    },
    {
      eventType: CLIMATE_EVENTS.EXTREME_WEATHER,
      handle(event, state) {
        const s = state as EnergyState;
        const severity = event.data.severity as number;
        const region = event.data.region as string;
        let newNations = { ...s.nations };
        let priceSpike = severity * 0.08;

        for (const [id, n] of Object.entries(newNations)) {
          const renewableShare = n.energyMix.renewable / 100;
          const resilience = renewableShare * 0.5 + (1 - renewableShare) * 0.3;
          const hit = severity * (1 - resilience) * 0.05;
          newNations[id] = {
            ...n,
            totalConsumption: Math.max(0, n.totalConsumption - hit * n.totalConsumption),
            energyPrice: n.energyPrice * (1 + priceSpike),
            wars: [...n.wars],
          };
        }

        return { ...s, nations: newNations, globalEnergyPrice: s.globalEnergyPrice * (1 + priceSpike) };
      },
    },
    {
      eventType: ECONOMY_EVENTS.GDP_SHIFT,
      handle(event, state) {
        const s = state as EnergyState;
        const nationId = event.data.nationId as string;
        const n = s.nations[nationId];
        if (!n) return s;
        const gdpDelta = event.data.gdpDelta as number;
        const consumptionDelta = gdpDelta > 0 ? gdpDelta * 0.00001 : gdpDelta * 0.000005;
        let newNations = { ...s.nations };
        newNations[nationId] = { ...n, totalConsumption: Math.max(0, n.totalConsumption + consumptionDelta), wars: [...n.wars] };
        return { ...s, nations: newNations };
      },
    },
    {
      eventType: TECHNOLOGY_EVENTS.INNOVATION,
      handle(event, state) {
        const s = state as EnergyState;
        const nationId = event.data.nationId as string;
        const innovation = event.data.innovation as string;
        const n = s.nations[nationId];
        if (!n) return s;

        let newMix = { ...n.energyMix };
        if (innovation.toLowerCase().includes("solar") || innovation.toLowerCase().includes("renewable") || innovation.toLowerCase().includes("battery")) {
          newMix.renewable = Math.min(100, newMix.renewable + 5);
          newMix.coal = Math.max(0, newMix.coal - 3);
          newMix.gas = Math.max(0, newMix.gas - 2);
          const total = newMix.oil + newMix.gas + newMix.coal + newMix.nuclear + newMix.renewable;
          const scale = 100 / total;
          for (const k of Object.keys(newMix) as (keyof typeof newMix)[]) {
            newMix[k] = Math.round(newMix[k] * scale);
          }
        }

        let newNations = { ...s.nations };
        newNations[nationId] = { ...n, energyMix: newMix, wars: [...n.wars] };
        let globalRenew = s.globalRenewableShare;
        if (newMix.renewable > (n.energyMix.renewable ?? 0)) {
          globalRenew = Math.min(100, globalRenew + 0.2);
        }
        return { ...s, nations: newNations, globalRenewableShare: globalRenew };
      },
    },
  ];

  return {
    id: "energy",
    name: "Energy",
    cadence: 3,
    events,

    init(seed: number, config: Record<string, unknown>): EnergyState {
      const rawNations = config.nations as Record<string, { energyMix?: Record<string, number>; totalConsumption?: number; energyPrice?: number; energySecurity?: number; co2Intensity?: number }> | undefined;
      const year = (config.year as number) ?? 2026;

      const nations: Record<string, EnergyNationState> = {};
      if (rawNations) {
        for (const [id, n] of Object.entries(rawNations)) {
          nations[id] = {
            energyMix: n.energyMix as EnergyNationState["energyMix"] ?? { oil: 30, gas: 25, coal: 20, nuclear: 10, renewable: 15 },
            totalConsumption: (n.totalConsumption as number) ?? 100,
            energyPrice: (n.energyPrice as number) ?? 100,
            energySecurity: (n.energySecurity as number) ?? 70,
            co2Intensity: (n.co2Intensity as number) ?? 0.5,
            wars: [],
          };
        }
      }

      return {
        _sectorId: "energy",
        year,
        tickCount: 0,
        nations,
        globalEnergyPrice: 100,
        globalRenewableShare: 15,
      };
    },

    tick(state: SectorState, world: WorldContext): EnergyState {
      const s = state as EnergyState;
      const { rng, eventBus, tick } = world;
      let year = s.year;
      let globalPrice = s.globalEnergyPrice;
      let globalRenew = s.globalRenewableShare;
      const newNations: Record<string, EnergyNationState> = {};

      year += 1;

      for (const [id, n] of Object.entries(s.nations)) {
        const priceNoise = (rng.next() - 0.5) * 6;
        let newPrice = n.energyPrice + priceNoise;
        newPrice = clamp(newPrice, 30, 300);

        const demandGrowth = (rng.next() - 0.5) * 2 + 1;
        let newConsumption = n.totalConsumption * (1 + demandGrowth / 100);
        newConsumption = Math.max(10, newConsumption);

        const renewableDrift = (rng.next() - 0.5) * 0.5;
        let newMix = { ...n.energyMix };
        newMix.renewable = clamp(newMix.renewable + renewableDrift + 0.2, 0, 100);
        newMix.coal = clamp(newMix.coal - renewableDrift * 0.5, 0, 100);
        const total = newMix.oil + newMix.gas + newMix.coal + newMix.nuclear + newMix.renewable;
        if (total > 0 && Math.abs(total - 100) > 0.5) {
          const scale = 100 / total;
          for (const k of Object.keys(newMix) as (keyof typeof newMix)[]) {
            newMix[k] = Math.round(newMix[k] * scale);
          }
        }

        const newSecurity = clamp(n.energySecurity + (rng.next() - 0.5) * 2, 0, 100);
        const newCo2 = n.co2Intensity * (1 - (newMix.renewable - (n.energyMix.renewable ?? 0)) * 0.005);

        if (Math.abs(newPrice - n.energyPrice) > n.energyPrice * 0.03) {
          publishTyped(eventBus, {
            type: ENERGY_EVENTS.PRICE_SHIFT,
            source: "energy",
            data: { nationId: id, oldPrice: n.energyPrice, newPrice, cause: "market" },
            tick,
          });
        }

        if (Math.abs(newMix.renewable - (n.energyMix.renewable ?? 0)) >= 2) {
          publishTyped(eventBus, {
            type: ENERGY_EVENTS.MIX_SHIFT,
            source: "energy",
            data: { nationId: id, oldRenewable: n.energyMix.renewable ?? 0, newRenewable: newMix.renewable, year },
            tick,
          });
        }

        newNations[id] = {
          energyMix: newMix,
          totalConsumption: newConsumption,
          energyPrice: newPrice,
          energySecurity: newSecurity,
          co2Intensity: newCo2,
          wars: [...n.wars],
        };
      }

      const priceNoise = (rng.next() - 0.5) * 4;
      globalPrice = clamp(globalPrice + priceNoise, 40, 250);
      globalRenew = clamp(globalRenew + (rng.next() - 0.5) * 1 + 0.3, 5, 100);

      return {
        ...s,
        year,
        tickCount: s.tickCount + 1,
        nations: newNations,
        globalEnergyPrice: globalPrice,
        globalRenewableShare: globalRenew,
      };
    },

    handlers,
  };
}
