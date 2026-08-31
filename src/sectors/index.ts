export { createEventBus } from "./event-bus.js";
export { publishTyped, SECTOR_EVENTS, EVENT_SUBSCRIPTIONS, GEOPOLITICS_EVENTS, CLIMATE_EVENTS, ECONOMY_EVENTS, TECHNOLOGY_EVENTS, ENERGY_EVENTS, DEMOGRAPHICS_EVENTS } from "./events.js";
export type { KnownEventType, TypedWorldEvent, EventPayloadMap } from "./events.js";
export type {
  SectorId,
  SectorState,
  WorldEvent,
  TickHandler,
  WorldContext,
  Sector,
  EventBus,
  RNG,
} from "./types.js";
// Sector factories — every world sector can be created via the index.
export { createGeopoliticsSector } from "./geopolitics.js";
export { createClimateSector } from "./climate.js";
export { createEconomySector } from "./economy.js";
export { createTechnologySector } from "./technology.js";
export { createEnergySector } from "./energy.js";
export { createDemographicsSector } from "./demographics.js";
