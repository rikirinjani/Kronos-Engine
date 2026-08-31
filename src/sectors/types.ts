export type SectorId = string;

export interface SectorState {
  _sectorId: SectorId;
}

export interface WorldEvent {
  type: string;
  source: SectorId;
  data: Record<string, unknown>;
  tick: number;
}

export interface TickHandler {
  eventType: string;
  handle(event: WorldEvent, state: SectorState): SectorState;
}

export interface RNG {
  next(): number;
}

export interface WorldContext {
  tick: number;
  rng: RNG;
  eventBus: EventBus;
}

export interface Sector {
  id: SectorId;
  name: string;
  cadence: number;
  init(seed: number, config: Record<string, unknown>): SectorState;
  tick(state: SectorState, world: WorldContext): SectorState;
  handlers: TickHandler[];
  events: string[];
}

export interface EventBus {
  publish(event: WorldEvent): void;
  subscribe(eventType: string, handler: TickHandler): void;
  pending(): WorldEvent[];
  clear(): void;
}
