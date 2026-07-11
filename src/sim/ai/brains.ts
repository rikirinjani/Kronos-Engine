import type { RNG } from "../../sectors/types.js";

export interface WeightedOption {
  label: string;
  score: number;
}

export function utilityPick(options: WeightedOption[]): string {
  let best = options[0];
  for (let i = 1; i < options.length; i++) {
    if (options[i]!.score > best!.score) best = options[i];
  }
  return best!.label;
}

export function softmaxPick(options: WeightedOption[], temperature: number, rng: RNG): string {
  const max = Math.max(...options.map((o) => o.score));
  const exps = options.map((o) => Math.exp((o.score - max) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map((e) => e / sum);
  let roll = rng.next();
  for (let i = 0; i < probs.length; i++) {
    roll -= probs[i]!;
    if (roll <= 0) return options[i]!.label;
  }
  return options[options.length - 1]!.label;
}

function dot(a: Float64Array, b: Float64Array, n: number): number {
  let s = 0;
  for (let i = 0; i < n; i++) s += a[i]! * b[i]!;
  return s;
}

function relu(x: number): number {
  return x > 0 ? x : 0;
}

export class TinyMLP {
  readonly weights: Float64Array;
  private readonly inputs: number;
  private readonly hidden: number;
  private readonly outputs: number;
  private readonly ih: number;
  private readonly ho: number;

  constructor(inputs: number, hidden: number, outputs: number, rng: RNG) {
    this.inputs = inputs;
    this.hidden = hidden;
    this.outputs = outputs;
    this.ih = inputs * hidden;
    this.ho = hidden * outputs;
    const total = this.ih + this.ho;
    this.weights = new Float64Array(total);
    for (let i = 0; i < total; i++) this.weights[i] = (rng.next() - 0.5) * 2;
  }

  forward(input: Float64Array): Float64Array {
    const hiddenOut = new Float64Array(this.hidden);
    for (let h = 0; h < this.hidden; h++) {
      let s = 0;
      for (let i = 0; i < this.inputs; i++) s += input[i]! * this.weights[h * this.inputs + i]!;
      hiddenOut[h] = relu(s);
    }
    const output = new Float64Array(this.outputs);
    for (let o = 0; o < this.outputs; o++) {
      output[o] = dot(hiddenOut, this.weights.subarray(this.ih + o * this.hidden, this.ih + (o + 1) * this.hidden), this.hidden);
    }
    return output;
  }
}

export class MarkovChain {
  private readonly order: number;
  private readonly rng: RNG;
  private readonly counts: Map<string, Map<string, number>> = new Map();

  constructor(order: number, rng: RNG) {
    this.order = order;
    this.rng = rng;
  }

  train(sequence: string[]): void {
    for (let i = 0; i <= sequence.length - this.order; i++) {
      const key = sequence.slice(i, i + this.order).join("\x00");
      const next = sequence[i + this.order];
      if (next === undefined) break;
      let follow = this.counts.get(key);
      if (!follow) { follow = new Map(); this.counts.set(key, follow); }
      follow.set(next, (follow.get(next) ?? 0) + 1);
    }
  }

  generate(length: number): string[] {
    const keys = Array.from(this.counts.keys());
    if (keys.length === 0) return [];
    const result: string[] = keys[Math.floor(this.rng.next() * keys.length)]!.split("\x00");
    while (result.length < length) {
      const key = result.slice(result.length - this.order).join("\x00");
      const follow = this.counts.get(key);
      if (!follow) break;
      const total = Array.from(follow.values()).reduce((a, b) => a + b, 0);
      let roll = this.rng.next() * total;
      let chosen: string | undefined;
      for (const [token, count] of follow) {
        roll -= count;
        if (roll <= 0) { chosen = token; break; }
      }
      if (!chosen) break;
      result.push(chosen);
    }
    return result;
  }
}

export type FSMState = string;
export type FSMEvent = string;

export interface FSMRule {
  from: FSMState;
  on: FSMEvent;
  to: FSMState;
}

export function fsmStep(current: FSMState, event: FSMEvent, rules: FSMRule[]): FSMState {
  for (let i = 0; i < rules.length; i++) {
    if (rules[i]!.from === current && rules[i]!.on === event) return rules[i]!.to;
  }
  return current;
}

export interface GOAPAction {
  name: string;
  cost: number;
  preconditions: Record<string, boolean>;
  effects: Record<string, boolean>;
}

export function goapPlan(start: Record<string, boolean>, goal: Record<string, boolean>, actions: GOAPAction[]): GOAPAction[] | null {
  const visited = new Set<string>();
  const queue: { state: Record<string, boolean>; plan: GOAPAction[]; cost: number }[] = [{ state: { ...start }, plan: [], cost: 0 }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    const key = JSON.stringify(Object.entries(current.state).sort());
    if (visited.has(key)) continue;
    visited.add(key);

    let goalMet = true;
    for (const [k, v] of Object.entries(goal)) {
      if (current.state[k] !== v) { goalMet = false; break; }
    }
    if (goalMet) return current.plan;

    for (const action of actions) {
      let feasible = true;
      for (const [k, v] of Object.entries(action.preconditions)) {
        if (current.state[k] !== v) { feasible = false; break; }
      }
      if (!feasible) continue;
      const nextState = { ...current.state, ...action.effects };
      queue.push({ state: nextState, plan: [...current.plan, action], cost: current.cost + action.cost });
    }
  }
  return null;
}

export class MemoryRing<T> {
  private readonly buffer: T[];
  private readonly capacity: number;
  private index = 0;
  private size = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array<T>(capacity);
  }

  remember(item: T): void {
    this.buffer[this.index] = item;
    this.index = (this.index + 1) % this.capacity;
    if (this.size < this.capacity) this.size++;
  }

  recall(count: number): T[] {
    const result: T[] = [];
    const start = this.size < this.capacity ? 0 : this.index;
    const len = Math.min(count, this.size);
    for (let i = 0; i < len; i++) {
      result.push(this.buffer[(start - len + i + this.capacity) % this.capacity]!);
    }
    return result;
  }

  recallAll(): T[] {
    return this.recall(this.size);
  }
}
