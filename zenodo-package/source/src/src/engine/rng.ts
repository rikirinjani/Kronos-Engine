import type { RNG } from "../sectors/types.js";

export interface RNGState {
  seed: number;
  callCount: number;
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRNG(seed: number): RNG & { save(): RNGState } {
  let callCount = 0;
  let gen = mulberry32(seed);

  return {
    next(): number {
      callCount++;
      return gen();
    },
    save(): RNGState {
      return { seed, callCount };
    },
  };
}

export function restoreRNG(state: RNGState): RNG & { save(): RNGState } {
  let callCount = state.callCount;
  let gen = mulberry32(state.seed);

  for (let i = 0; i < callCount; i++) {
    gen();
  }

  return {
    next(): number {
      callCount++;
      return gen();
    },
    save(): RNGState {
      return { seed: state.seed, callCount };
    },
  };
}
