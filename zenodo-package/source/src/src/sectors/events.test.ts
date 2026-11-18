import { describe, it, expect } from "vitest";
import {
  GEOPOLITICS_EVENTS, CLIMATE_EVENTS, ECONOMY_EVENTS, TECHNOLOGY_EVENTS,
  SECTOR_EVENTS, EVENT_SUBSCRIPTIONS,
  publishTyped,
} from "./events.js";
import { createEventBus } from "./event-bus.js";
import type { RNG } from "./types.js";

function mulberry32(seed: number): RNG {
  let s = seed | 0;
  return {
    next(): number {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

describe("Event Catalog", () => {
  it("defines all geopolitics event constants", () => {
    expect(GEOPOLITICS_EVENTS.RELATION_SHIFT).toBe("geopolitics.relation_shift");
    expect(GEOPOLITICS_EVENTS.WAR_START).toBe("geopolitics.war_start");
    expect(GEOPOLITICS_EVENTS.WAR_END).toBe("geopolitics.war_end");
    expect(GEOPOLITICS_EVENTS.WAR_CASUALTIES).toBe("geopolitics.war_casualties");
  });

  it("defines all climate event constants", () => {
    expect(CLIMATE_EVENTS.TEMP_SHIFT).toBe("climate.temp_shift");
    expect(CLIMATE_EVENTS.EXTREME_WEATHER).toBe("climate.extreme_weather");
    expect(CLIMATE_EVENTS.EMISSIONS_CHANGE).toBe("climate.emissions_change");
  });

  it("defines all economy event constants", () => {
    expect(ECONOMY_EVENTS.GDP_SHIFT).toBe("economy.gdp_shift");
    expect(ECONOMY_EVENTS.INFLATION_CHANGE).toBe("economy.inflation_change");
    expect(ECONOMY_EVENTS.TRADE_SHIFT).toBe("economy.trade_shift");
  });

  it("defines all technology event constants", () => {
    expect(TECHNOLOGY_EVENTS.INNOVATION).toBe("technology.innovation");
    expect(TECHNOLOGY_EVENTS.DIFFUSION).toBe("technology.diffusion");
  });

  it("registers all events per sector", () => {
    expect(SECTOR_EVENTS.geopolitics).toEqual([
      "geopolitics.relation_shift", "geopolitics.war_start",
      "geopolitics.war_end", "geopolitics.war_casualties",
    ]);
    expect(SECTOR_EVENTS.climate).toEqual([
      "climate.temp_shift", "climate.extreme_weather", "climate.emissions_change",
    ]);
    expect(SECTOR_EVENTS.economy).toEqual([
      "economy.gdp_shift", "economy.inflation_change", "economy.trade_shift",
    ]);
    expect(SECTOR_EVENTS.technology).toEqual([
      "technology.innovation", "technology.diffusion",
    ]);
  });

  it("registers all cross-sector subscriptions", () => {
    expect(EVENT_SUBSCRIPTIONS.geopolitics).toContain("economy.gdp_shift");
    expect(EVENT_SUBSCRIPTIONS.climate).toContain("economy.gdp_shift");
    expect(EVENT_SUBSCRIPTIONS.economy).toContain("geopolitics.war_start");
    expect(EVENT_SUBSCRIPTIONS.economy).toContain("geopolitics.war_casualties");
    expect(EVENT_SUBSCRIPTIONS.economy).toContain("climate.extreme_weather");
    expect(EVENT_SUBSCRIPTIONS.technology).toContain("economy.gdp_shift");
  });
});

describe("publishTyped", () => {
  it("publishes a typed event and type-checks the payload", () => {
    const bus = createEventBus();
    const handled: string[] = [];

    bus.subscribe(GEOPOLITICS_EVENTS.WAR_START, {
      eventType: GEOPOLITICS_EVENTS.WAR_START,
      handle(event, state) {
        handled.push(event.data.warId as string);
        return state;
      },
    });

    publishTyped(bus, {
      type: GEOPOLITICS_EVENTS.WAR_START,
      source: "geopolitics",
      data: { warId: "W-1", name: "Test War", attackers: ["A"], defenders: ["B"], year: 2026 },
      tick: 1,
    });

    expect(handled).toEqual(["W-1"]);
  });
});
