import { describe, it, expect } from "vitest";
import { createEventBus } from "./event-bus.js";
import type { SectorState } from "./types.js";

describe("EventBus", () => {
  it("publishes an event to its subscribers", () => {
    const bus = createEventBus();
    const handled: string[] = [];

    bus.subscribe("test.event", {
      eventType: "test.event",
      handle(event, state) {
        handled.push(event.data.msg as string);
        return state;
      },
    });

    bus.publish({
      type: "test.event",
      source: "sector-a",
      data: { msg: "hello" },
      tick: 1,
    });

    expect(handled).toEqual(["hello"]);
  });

  it("queues published events", () => {
    const bus = createEventBus();
    bus.publish({ type: "e1", source: "s1", data: {}, tick: 1 });
    bus.publish({ type: "e2", source: "s2", data: {}, tick: 2 });

    expect(bus.pending()).toHaveLength(2);
    expect(bus.pending()[0]!.type).toBe("e1");
    expect(bus.pending()[1]!.type).toBe("e2");
  });

  it("does not call subscribers for unsubscribed event types", () => {
    const bus = createEventBus();
    let called = false;

    bus.subscribe("type-a", {
      eventType: "type-a",
      handle(_event, state) {
        called = true;
        return state;
      },
    });

    bus.publish({ type: "type-b", source: "s1", data: {}, tick: 1 });

    expect(called).toBe(false);
  });

  it("calls all subscribers for the same event type", () => {
    const bus = createEventBus();
    const results: number[] = [];

    const baseState: SectorState = { _sectorId: "test" };

    bus.subscribe("evt", {
      eventType: "evt",
      handle(_event, state) {
        results.push(1);
        return state;
      },
    });
    bus.subscribe("evt", {
      eventType: "evt",
      handle(_event, state) {
        results.push(2);
        return state;
      },
    });

    bus.publish({ type: "evt", source: "s1", data: {}, tick: 1 });

    expect(results.sort()).toEqual([1, 2]);
  });

  it("clears the pending queue", () => {
    const bus = createEventBus();
    bus.publish({ type: "e1", source: "s1", data: {}, tick: 1 });
    bus.clear();
    expect(bus.pending()).toHaveLength(0);
  });
});
