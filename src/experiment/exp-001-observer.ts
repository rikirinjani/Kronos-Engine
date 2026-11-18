import type { Sector, SectorState, TickHandler, WorldContext } from "../sectors/types.js";

/**
 * EXP-001 passive observer sector.
 *
 * Accumulates per-event-type counts (plus first-seen tick and a running total)
 * for the cross-sector event stream. It has no autonomous behavior — `tick`
 * returns the state unchanged and all recording happens through TickHandlers,
 * mirroring the health-surveillance observer pattern.
 *
 * The observer is appended LAST in the experiment's sector list so that the RNG
 * draw sequence for the pre-existing sectors is unchanged.
 */
export interface Exp001ObserverState extends SectorState {
  _sectorId: "exp-001-observer";
  /** Per-event-type occurrence counts. */
  eventCounts: Record<string, number>;
  /** Tick at which each event type was first observed (absent = never seen). */
  firstEventTick: Record<string, number>;
  /** Total events observed across all registered types. */
  totalEvents: number;
}

/** Event types the EXP-001 observer records. */
export const EXP001_OBSERVED_EVENT_TYPES = [
  "geopolitics.relation_shift",
  "geopolitics.war_start",
  "geopolitics.war_end",
  "geopolitics.war_casualties",
  "climate.temp_shift",
  "climate.extreme_weather",
  "climate.emissions_change",
  "economy.gdp_shift",
  "economy.inflation_change",
  "economy.trade_shift",
  "technology.innovation",
  "technology.diffusion",
  "health.pressure",
  "health.mortality",
  "health.supply-crisis",
  "health.surge",
  "health.down",
] as const;

/** Build a handler that counts one event type, records its first tick, and bumps the running total. */
function recordEvent(eventType: string) {
  return (event: { tick: number }, state: Exp001ObserverState): Exp001ObserverState => {
    const firstEventTick = state.firstEventTick[eventType] ?? event.tick;
    return {
      ...state,
      eventCounts: {
        ...state.eventCounts,
        [eventType]: (state.eventCounts[eventType] ?? 0) + 1,
      },
      firstEventTick: {
        ...state.firstEventTick,
        [eventType]: firstEventTick,
      },
      totalEvents: state.totalEvents + 1,
    };
  };
}

export function createExp001ObserverSector(): Sector {
  const handlers: TickHandler[] = EXP001_OBSERVED_EVENT_TYPES.map((eventType) => ({
    eventType,
    handle: (e, s) => recordEvent(eventType)(e, s as Exp001ObserverState),
  }));

  return {
    id: "exp-001-observer",
    name: "EXP-001 Observer",
    cadence: 1,
    events: [...EXP001_OBSERVED_EVENT_TYPES],

    init(_seed: number, _config: Record<string, unknown>): Exp001ObserverState {
      return {
        _sectorId: "exp-001-observer",
        eventCounts: {},
        firstEventTick: {},
        totalEvents: 0,
      };
    },

    tick(state: SectorState, _ctx: WorldContext): Exp001ObserverState {
      // Passive recorder — no autonomous behavior; handlers do the work.
      return state as Exp001ObserverState;
    },

    handlers,
  };
}