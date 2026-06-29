import type { Sector, SectorState, WorldContext, TickHandler } from "./types.js";
import { CLIMATE_EVENTS, GEOPOLITICS_EVENTS, ECONOMY_EVENTS } from "./events.js";
import type { World } from "../../../Deers-Rock/dist/index.js";
import type { HospitalState } from "../../../Deers-Rock/dist/engine/state-store.js";
import { createWorld, step } from "../../../Deers-Rock/dist/index.js";

const TICKS_PER_WORLD_TICK = 1440;

export interface HospitalSentinelConfig {
  id: string;
  city: string;
  beds: number;
  patients: number;
  ticksPerDay?: number;
}

export interface MacroConditionPacket {
  tick: number;
  admissionMultiplier: number;
  diagnosisWeightOverrides: Record<string, number>;
  supplyChainPressure: number;
  staffAvailabilityModifier: number;
  activeDisasterType?: string;
}

export interface HospitalSentinelOutput {
  tick: number;
  hospitalId: string;
  city: string;
  occupancyRate: number;
  icuOccupancyRate: number;
  mortalityPressure: number;
  diseasePrevalence: Record<string, number>;
  supplyStress: number;
  staffStress: number;
  admissionSurge: boolean;
}

export interface DeersRockSectorState extends SectorState {
  _sectorId: "deers-rock";
  config: HospitalSentinelConfig;
  world: World;
  lastTickState: HospitalState;
  sentinelOutput: HospitalSentinelOutput | null;
  circuitBreakerTripped: boolean;
}

export const ADAPTER_INVARIANTS = {
  TRANSLATES_ONLY: "Adapter translates world events to hospital parameters. Never invents domain behavior.",
  DR_ISOLATION: "Deers Rock never sees Kronos concepts: GDP, wars, global temperature, or other hospitals.",
  LOCAL_SIGNAL_ONLY: "Sentinel output is local observation. Never extrapolated to national or regional level.",
  NO_PATIENT_DATA: "World Engine never sees patient-level data (vitals, bed assignments, identities). Only aggregated pressure signals.",
  INDEPENDENT_SEED: "Each sentinel derives its own RNG seed from world seed + hospitalId. No shared RNG state between instances.",
} as const;

export function getHospitalSeed(worldSeed: number, hospitalId: number): number {
  return (worldSeed ^ (hospitalId * 2654435761)) >>> 0;
}

export function createSentinels(sentinels: HospitalSentinelConfig[], worldSeed: number): Sector[] {
  return sentinels
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((config) => deersRockAdapter(config, worldSeed));
}

function extractOccupancy(state: HospitalState) {
  let occupied = 0;
  let icuOccupied = 0;
  const capacities = Object.values(state.wardCapacity as Record<string, number>);
  const totalCapacity = capacities.reduce((s, c) => s + c, 0);
  let icuCapacity = 0;

  for (const bed of state.beds.values()) {
    if (bed.patientId) {
      occupied++;
      if (bed.ward === "ICU" || bed.ward === "PICU" || bed.ward === "NICU") {
        icuOccupied++;
      }
    }
  }

  icuCapacity = (state.wardCapacity["ICU"] ?? 0) + (state.wardCapacity["PICU"] ?? 0) + (state.wardCapacity["NICU"] ?? 0);

  return { total: occupied, capacity: totalCapacity, icu: icuOccupied, icuCapacity };
}

function extractDiseasePrevalence(state: HospitalState): Record<string, number> {
  const icdCounts: Record<string, number> = {};
  for (const enc of state.encounters.values()) {
    const code = (enc as unknown as Record<string, unknown>).primaryDiagnosis as string || "UNKNOWN";
    icdCounts[code] = (icdCounts[code] ?? 0) + 1;
  }
  const sorted = Object.entries(icdCounts).sort(([, a], [, b]) => b - a).slice(0, 5);
  return Object.fromEntries(sorted);
}

function extractSentinelOutput(world: World, config: HospitalSentinelConfig, worldTick: number): HospitalSentinelOutput {
  const state = world.state;
  const occ = extractOccupancy(state);
  const mortalityCount = (state as unknown as Record<string, unknown>).morgue instanceof Array ? (state.morgue as unknown[]).length : 0;
  const diseasePrev = extractDiseasePrevalence(state);
  const supplyStress = 0.3;

  const activeEncounters = state.encounters.size;
  const staffStress = Math.min(1, activeEncounters / (Object.keys(state.wardCapacity).length * 3));

  return {
    tick: worldTick,
    hospitalId: config.id,
    city: config.city,
    occupancyRate: occ.capacity > 0 ? occ.total / occ.capacity : 0,
    icuOccupancyRate: occ.icuCapacity > 0 ? occ.icu / occ.icuCapacity : 0,
    mortalityPressure: mortalityCount,
    diseasePrevalence: diseasePrev,
    supplyStress,
    staffStress,
    admissionSurge: occ.total > occ.capacity * 0.9,
  };
}

export function buildMacroPacket(
  events: { type: string; data: Record<string, unknown> }[],
  worldTick: number,
): MacroConditionPacket {
  let admissionMultiplier = 1.0;
  const diagnosisWeightOverrides: Record<string, number> = {};
  let supplyChainPressure = 0;
  let staffAvailabilityModifier = 1.0;
  let activeDisasterType: string | undefined;

  for (const evt of events) {
    switch (evt.type) {
      case CLIMATE_EVENTS.EXTREME_WEATHER:
        admissionMultiplier += 0.3;
        supplyChainPressure = Math.max(supplyChainPressure, 0.4);
        activeDisasterType = "natural-disaster";
        diagnosisWeightOverrides["J00-J99"] = 1.3;
        break;
      case GEOPOLITICS_EVENTS.WAR_START:
        admissionMultiplier += 0.2;
        staffAvailabilityModifier = Math.min(staffAvailabilityModifier, 0.85);
        supplyChainPressure = Math.max(supplyChainPressure, 0.5);
        diagnosisWeightOverrides["S00-T88"] = 1.5;
        break;
      case GEOPOLITICS_EVENTS.WAR_CASUALTIES:
        supplyChainPressure = Math.min(1, supplyChainPressure + 0.1);
        break;
      case CLIMATE_EVENTS.TEMP_SHIFT:
        diagnosisWeightOverrides["I00-I99"] = 1.15;
        break;
    }
  }

  return {
    tick: worldTick,
    admissionMultiplier,
    diagnosisWeightOverrides,
    supplyChainPressure: Math.min(1, supplyChainPressure),
    staffAvailabilityModifier,
    activeDisasterType,
  };
}

export function deersRockAdapter(config: HospitalSentinelConfig, worldSeed: number): Sector {
  const healthEvents = ["health.pressure", "health.mortality", "health.disease-burden", "health.supply-crisis", "health.surge", "health.down"];

  const handlers: TickHandler[] = [];

  return {
    id: `deers-rock-${config.id}`,
    name: `Deers Rock Sentinel (${config.city})`,
    events: healthEvents,

    init(_seed: number, _config: Record<string, unknown>): DeersRockSectorState {
      const hospitalSeed = getHospitalSeed(worldSeed, parseInt(config.id.replace(/\D/g, ""), 10) || 1);
      const drWorld = createWorld(config.patients, undefined, hospitalSeed);

      return {
        _sectorId: "deers-rock",
        config,
        world: drWorld,
        lastTickState: drWorld.state,
        sentinelOutput: null,
        circuitBreakerTripped: false,
      };
    },

    tick(state: SectorState, ctx: WorldContext): DeersRockSectorState {
      const s = state as DeersRockSectorState;
      let world = s.world;
      const pendingEvents = ctx.eventBus.pending();
      const macroPacket = buildMacroPacket(pendingEvents, ctx.tick);

      const ticksPerDay = s.config.ticksPerDay ?? TICKS_PER_WORLD_TICK;
      let circuitTripped = s.circuitBreakerTripped;

      for (let i = 0; i < ticksPerDay; i++) {
        if (i === 0 && macroPacket.admissionMultiplier !== 1.0) {
          world.queue.schedule("admission_surge", 0, { multiplier: macroPacket.admissionMultiplier });
        }
        if (i === 0 && macroPacket.staffAvailabilityModifier < 1.0) {
          world.queue.schedule("staff_shortage", 0, { modifier: macroPacket.staffAvailabilityModifier });
        }
        try {
          world = step(world);
          circuitTripped = false;
        } catch (err) {
          circuitTripped = true;
          ctx.eventBus.publish({
            type: "health.down",
            source: s.config.id,
            data: { hospitalId: s.config.id, city: s.config.city, error: String(err), tick: ctx.tick },
            tick: ctx.tick,
          });
          world = { ...world, state: s.lastTickState };
        }
      }

      const sentinelOutput = extractSentinelOutput(world, s.config, ctx.tick);

      if (sentinelOutput.occupancyRate > 0.85) {
        ctx.eventBus.publish({
          type: "health.pressure",
          source: s.config.id,
          data: { hospitalId: s.config.id, city: s.config.city, occupancyRate: sentinelOutput.occupancyRate },
          tick: ctx.tick,
        });
      }

      if (sentinelOutput.mortalityPressure > 0) {
        ctx.eventBus.publish({
          type: "health.mortality",
          source: s.config.id,
          data: { hospitalId: s.config.id, city: s.config.city, deaths: sentinelOutput.mortalityPressure },
          tick: ctx.tick,
        });
      }

      if (sentinelOutput.supplyStress > 0.7) {
        ctx.eventBus.publish({
          type: "health.supply-crisis",
          source: s.config.id,
          data: { hospitalId: s.config.id, city: s.config.city, supplyStress: sentinelOutput.supplyStress },
          tick: ctx.tick,
        });
      }

      if (sentinelOutput.admissionSurge) {
        ctx.eventBus.publish({
          type: "health.surge",
          source: s.config.id,
          data: { hospitalId: s.config.id, city: s.config.city, occupancyRate: sentinelOutput.occupancyRate },
          tick: ctx.tick,
        });
      }

      return {
        ...s,
        world,
        lastTickState: world.state,
        sentinelOutput,
        circuitBreakerTripped: circuitTripped,
      };
    },

    handlers,
  };
}
