import type { EventBus, WorldEvent, TickHandler, SectorState } from "./types.js";

export function createEventBus(): EventBus {
  const subscribers = new Map<string, TickHandler[]>();
  const queue: WorldEvent[] = [];

  return {
    publish(event: WorldEvent): void {
      queue.push(event);
      const handlers = subscribers.get(event.type);
      if (handlers) {
        for (const h of handlers) {
          h.handle(event, { _sectorId: event.source });
        }
      }
    },

    subscribe(eventType: string, handler: TickHandler): void {
      const existing = subscribers.get(eventType) ?? [];
      existing.push(handler);
      subscribers.set(eventType, existing);
    },

    pending(): WorldEvent[] {
      return [...queue];
    },

    clear(): void {
      queue.length = 0;
    },
  };
}
