import type { RNG } from "../sectors/types.js";
import { utilityPick, softmaxPick, MemoryRing } from "./ai/brains.js";
import type { GeopoliticsState } from "../sectors/geopolitics.js";
import type { EconomyState } from "../sectors/economy.js";
import type { ClimateState } from "../sectors/climate.js";

export interface Agent<TState> {
  id: string;
  memory: MemoryRing<string>;
  tick(state: TState, rng: RNG): TState;
}

export function createCentralBankAgent(): Agent<EconomyState> {
  const memory = new MemoryRing<string>(10);
  return {
    id: "central-bank",
    memory,
    tick(state: EconomyState, rng: RNG): EconomyState {
      const inflation = state.globalInflation;
      const currentRate = state.nations["USA"]?.inflationRate ?? 3;
      const options = [
        { label: "cut", score: inflation < 2 ? 10 : inflation > 3 ? 0 : 5 },
        { label: "hold", score: inflation >= 2 && inflation <= 3 ? 10 : 3 },
        { label: "raise", score: inflation > 3 ? 10 : -5 },
      ];
      const decision = utilityPick(options);
      const newNations = { ...state.nations };
      for (const [id, n] of Object.entries(newNations)) {
        const adj = decision === "raise" ? -0.25 : decision === "cut" ? 0.25 : 0;
        newNations[id] = { ...n, inflationRate: Math.max(-2, Math.min(20, n.inflationRate + adj)) };
      }
      memory.remember(`tick=${state.tickCount}:${decision}`);
      return { ...state, nations: newNations };
    },
  };
}

export function createTradeAgent(): Agent<GeopoliticsState> {
  const memory = new MemoryRing<string>(10);
  return {
    id: "trade-agent",
    memory,
    tick(state: GeopoliticsState, rng: RNG): GeopoliticsState {
      const newNations = { ...state.nations };
      for (const [id, nation] of Object.entries(newNations)) {
        const lowRelEntries = Object.entries(nation.relations).filter(([, v]) => v < 20);
        if (lowRelEntries.length === 0) continue;
        const targetId = lowRelEntries[Math.floor(rng.next() * lowRelEntries.length)]![0];
        const oldVal = nation.relations[targetId] ?? 0;
        const newVal = Math.max(-100, oldVal - 5);
        nation.relations[targetId] = newVal;
        memory.remember(`${id} tariff ${targetId}`);
      }
      return { ...state, nations: newNations };
    },
  };
}

export type AnyAgent = Agent<EconomyState> | Agent<GeopoliticsState> | Agent<ClimateState>;
