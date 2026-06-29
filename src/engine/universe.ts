export interface UniverseID {
  id: string;
  rngSeed: number;
  parent: string | null;
  rewindTick: number | null;
  intervention: string | null;
  created: string;
  label: string;
}

let _counter = 0;

const YEAR = new Date().getFullYear();

export function createUniverse(seed: number, label?: string): UniverseID {
  _counter++;
  const id = `U-${YEAR}-${String(_counter).padStart(4, "0")}`;
  return {
    id,
    rngSeed: seed,
    parent: null,
    rewindTick: null,
    intervention: null,
    created: new Date().toISOString(),
    label: label ?? `Universe ${id}`,
  };
}

export function branchUniverse(
  parent: UniverseID,
  rewindTick: number,
  intervention: string,
  label?: string,
): UniverseID {
  _counter++;
  const id = `U-${YEAR}-${String(_counter).padStart(4, "0")}`;
  return {
    id,
    rngSeed: parent.rngSeed,
    parent: parent.id,
    rewindTick,
    intervention,
    created: new Date().toISOString(),
    label: label ?? `Branch from ${parent.id} at tick ${rewindTick}`,
  };
}

export function resetUniverseCounter(): void {
  _counter = 0;
}
