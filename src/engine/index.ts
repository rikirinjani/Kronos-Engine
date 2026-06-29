export { createRNG, restoreRNG } from "./rng.js";
export type { RNGState } from "./rng.js";
export { createUniverse, branchUniverse, resetUniverseCounter } from "./universe.js";
export type { UniverseID } from "./universe.js";
export { createWorld, tick, run, snapshot, restoreSnapshot } from "./world-engine.js";
export type { WorldState, WorldSnapshot, WorldConfig, SectorRecord } from "./world-engine.js";
