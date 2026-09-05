import type { Sector, SectorState, WorldContext, TickHandler } from "./types.js";

export interface HealthSurveillanceState extends SectorState {
  _sectorId: "health-surveillance";
  /** latest signal per hospital (keyed — NEVER aggregated to national level) */
  latest: Record<
    string,
    {
      tick: number;
      hospitalId: string;
      city: string;
      occupancyRate?: number;
      deaths?: number;
      supplyStress?: number;
      down?: boolean;
    }
  >;
  /** per-event-type counters */
  eventCounts: Record<string, number>;
}

function recordPressure(event: { data: Record<string, unknown>; tick: number }, state: HealthSurveillanceState): HealthSurveillanceState {
  const hid = event.data.hospitalId as string;
  const existing = state.latest[hid] ?? { tick: event.tick, hospitalId: hid, city: event.data.city as string };
  return {
    ...state,
    latest: {
      ...state.latest,
      [hid]: { ...existing, tick: event.tick, occupancyRate: event.data.occupancyRate as number },
    },
    eventCounts: {
      ...state.eventCounts,
      "health.pressure": (state.eventCounts["health.pressure"] ?? 0) + 1,
    },
  };
}

function recordMortality(event: { data: Record<string, unknown>; tick: number }, state: HealthSurveillanceState): HealthSurveillanceState {
  const hid = event.data.hospitalId as string;
  const existing = state.latest[hid] ?? { tick: event.tick, hospitalId: hid, city: event.data.city as string };
  return {
    ...state,
    latest: {
      ...state.latest,
      [hid]: { ...existing, tick: event.tick, deaths: event.data.deaths as number },
    },
    eventCounts: {
      ...state.eventCounts,
      "health.mortality": (state.eventCounts["health.mortality"] ?? 0) + 1,
    },
  };
}

function recordSupplyCrisis(event: { data: Record<string, unknown>; tick: number }, state: HealthSurveillanceState): HealthSurveillanceState {
  const hid = event.data.hospitalId as string;
  const existing = state.latest[hid] ?? { tick: event.tick, hospitalId: hid, city: event.data.city as string };
  return {
    ...state,
    latest: {
      ...state.latest,
      [hid]: { ...existing, tick: event.tick, supplyStress: event.data.supplyStress as number },
    },
    eventCounts: {
      ...state.eventCounts,
      "health.supply-crisis": (state.eventCounts["health.supply-crisis"] ?? 0) + 1,
    },
  };
}

function recordSurge(event: { data: Record<string, unknown>; tick: number }, state: HealthSurveillanceState): HealthSurveillanceState {
  const hid = event.data.hospitalId as string;
  const existing = state.latest[hid] ?? { tick: event.tick, hospitalId: hid, city: event.data.city as string };
  return {
    ...state,
    latest: {
      ...state.latest,
      [hid]: { ...existing, tick: event.tick, occupancyRate: event.data.occupancyRate as number },
    },
    eventCounts: {
      ...state.eventCounts,
      "health.surge": (state.eventCounts["health.surge"] ?? 0) + 1,
    },
  };
}

function recordDown(event: { data: Record<string, unknown>; tick: number }, state: HealthSurveillanceState): HealthSurveillanceState {
  const hid = event.data.hospitalId as string;
  const existing = state.latest[hid] ?? { tick: event.tick, hospitalId: hid, city: event.data.city as string };
  return {
    ...state,
    latest: {
      ...state.latest,
      [hid]: { ...existing, tick: event.tick, down: true },
    },
    eventCounts: {
      ...state.eventCounts,
      "health.down": (state.eventCounts["health.down"] ?? 0) + 1,
    },
  };
}

const HEALTH_EVENT_TYPES = [
  "health.pressure",
  "health.mortality",
  "health.supply-crisis",
  "health.surge",
  "health.down",
] as const;

export function createHealthSurveillanceSector(): Sector {
  const handlers: TickHandler[] = [
    { eventType: "health.pressure", handle: (e, s) => recordPressure(e, s as HealthSurveillanceState) },
    { eventType: "health.mortality", handle: (e, s) => recordMortality(e, s as HealthSurveillanceState) },
    { eventType: "health.supply-crisis", handle: (e, s) => recordSupplyCrisis(e, s as HealthSurveillanceState) },
    { eventType: "health.surge", handle: (e, s) => recordSurge(e, s as HealthSurveillanceState) },
    { eventType: "health.down", handle: (e, s) => recordDown(e, s as HealthSurveillanceState) },
  ];

  return {
    id: "health-surveillance",
    name: "Health Surveillance",
    cadence: 1,
    events: [...HEALTH_EVENT_TYPES],

    init(_seed: number, _config: Record<string, unknown>): HealthSurveillanceState {
      return {
        _sectorId: "health-surveillance",
        latest: {},
        eventCounts: {},
      };
    },

    tick(state: SectorState, _ctx: WorldContext): HealthSurveillanceState {
      // Passive recorder — no autonomous behavior; handlers do the work.
      return state as HealthSurveillanceState;
    },

    handlers,
  };
}
