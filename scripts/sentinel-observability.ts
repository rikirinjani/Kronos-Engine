/**
 * SENTINEL OBSERVABILITY — Phase B/C/D sensitivity harness (diagnostic only).
 *
 * Drives the Deers Rock hospital DIRECTLY with controlled macro inputs, bypassing
 * the Kronos adapter, to determine whether the hospital model responds to the
 * values the adapter actually supplies. No production code modified.
 *
 * Run: npx tsx scripts/sentinel-observability.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createWorld, step, computeSupplyStress } from "../../Deers-Rock/dist/index.js";
import { getHospitalSeed } from "../src/sectors/deers-rock-adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATIENTS = 50;
const WORLD_SEED = 42;
const HOSPITAL_ID = "makassar-001";
const TICKS_PER_KE_TICK = 10; // config.ticksPerDay

function hospitalSeed(): number {
  let hash = 0;
  for (let i = 0; i < HOSPITAL_ID.length; i++) {
    hash = ((hash << 5) - hash) + HOSPITAL_ID.charCodeAt(i);
    hash |= 0;
  }
  return getHospitalSeed(WORLD_SEED, Math.abs(hash) || 1);
}

interface Macro {
  admissionMultiplier?: number;
  supplyChainPressure?: number;
  activeDisaster?: string;
  staffModifier?: number;
}

interface Obs {
  keTick: number;
  occupancy: number;
  icuOccupancy: number;
  supplyStress: number;
  encounters: number;
  morgue: number;
  admissions: number; // cumulative patients placed in beds
}

function runCase(macro: Macro, keTicks: number): Obs[] {
  const seed = hospitalSeed();
  let world = createWorld(PATIENTS, undefined, seed);
  const out: Obs[] = [];
  let prevOccupied = 0;
  let cumAdmissions = 0;

  for (let k = 0; k < keTicks; k++) {
    for (let i = 0; i < TICKS_PER_KE_TICK; i++) {
      if (i === 0) {
        if (macro.admissionMultiplier !== undefined && macro.admissionMultiplier !== 1.0) {
          world.queue.schedule("admission_surge", 0, { multiplier: macro.admissionMultiplier });
        }
        if (macro.staffModifier !== undefined && macro.staffModifier < 1.0) {
          world.queue.schedule("staff_shortage", 0, { modifier: macro.staffModifier });
        }
        if (macro.supplyChainPressure !== undefined && macro.supplyChainPressure > 0) {
          world.queue.schedule("supply_chain_pressure", 0, { pressure: macro.supplyChainPressure });
        }
        if (macro.activeDisaster) {
          world.queue.schedule("active_disaster", 0, { disasterType: macro.activeDisaster });
        }
      }
      world = step(world);
    }
    const st = world.state;
    let occupied = 0, icuOccupied = 0;
    for (const bed of st.beds.values()) {
      if (bed.patientId) {
        occupied++;
        if (bed.ward === "ICU" || bed.ward === "PICU" || bed.ward === "NICU") icuOccupied++;
      }
    }
    const caps = Object.values(st.wardCapacity);
    const totalCap = caps.reduce((a, b) => a + b, 0);
    const icuCap = (st.wardCapacity["ICU"] ?? 0) + (st.wardCapacity["PICU"] ?? 0) + (st.wardCapacity["NICU"] ?? 0);
    if (occupied > prevOccupied) cumAdmissions += occupied - prevOccupied;
    prevOccupied = occupied;

    out.push({
      keTick: k + 1,
      occupancy: totalCap > 0 ? occupied / totalCap : 0,
      icuOccupancy: icuCap > 0 ? icuOccupied / icuCap : 0,
      supplyStress: computeSupplyStress(st),
      encounters: st.encounters.size,
      morgue: (st as any).morgue instanceof Array ? (st as any).morgue.length : 0,
      admissions: cumAdmissions,
    });
  }
  return out;
}

const last = (o: Obs[]) => o[o.length - 1]!;
const r4 = (v: number) => Math.round(v * 10000) / 10000;

mkdirSync(join(__dirname, "../experiment-results/sentinel-observability"), { recursive: true });

console.log("=== SENTINEL OBSERVABILITY — DIRECT DR SENSITIVITY TEST ===");
console.log(`hospital=${HOSPITAL_ID} patients=${PATIENTS} worldSeed=${WORLD_SEED} drTicksPerKeTick=${TICKS_PER_KE_TICK}`);
console.log();

// ---- B1: admissionMultiplier sweep ----------------------------------------
console.log("=== B1  admissionMultiplier sweep (final state at KE tick 20 = DR tick 200) ===");
console.log("mult | occupancy | icuOcc | supplyStress | encounters | morgue | cumAdmissions | Δocc vs 1.0");
const base = last(runCase({ admissionMultiplier: 1.0 }, 20));
for (const m of [1.0, 1.1, 1.3, 1.5, 2.0]) {
  const f = last(runCase({ admissionMultiplier: m }, 20));
  console.log(
    `${m.toFixed(2)} | ${r4(f.occupancy).toFixed(4).padStart(9)} | ${r4(f.icuOccupancy).toFixed(4).padStart(6)} | ${r4(f.supplyStress).toFixed(4).padStart(12)} | ${String(f.encounters).padStart(10)} | ${String(f.morgue).padStart(6)} | ${String(f.admissions).padStart(13)} | ${(r4(f.occupancy - base.occupancy)).toFixed(4)}`
  );
}

// ---- B2: supplyChainPressure sweep ----------------------------------------
console.log("\n=== B2  supplyChainPressure sweep (final state at KE tick 20) ===");
console.log("press | occupancy | supplyStress | encounters | ΔsupplyStress vs 0.0");
const baseS = last(runCase({ supplyChainPressure: 0.0 }, 20));
for (const p of [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]) {
  const f = last(runCase({ supplyChainPressure: p }, 20));
  console.log(
    `${p.toFixed(2)}  | ${r4(f.occupancy).toFixed(4).padStart(9)} | ${r4(f.supplyStress).toFixed(4).padStart(12)} | ${String(f.encounters).padStart(10)} | ${(r4(f.supplyStress - baseS.supplyStress)).toFixed(4)}`
  );
}

// ---- B3: activeDisasterType -----------------------------------------------
console.log("\n=== B3  activeDisasterType ===");
console.log("case                | occupancy | icuOcc | supplyStress | encounters | morgue | cumAdmissions");
for (const [label, macro] of [
  ["none", {}],
  ["natural-disaster", { activeDisaster: "natural-disaster" }],
] as [string, Macro][]) {
  const f = last(runCase(macro, 20));
  console.log(
    `${label.padEnd(19)} | ${r4(f.occupancy).toFixed(4).padStart(9)} | ${r4(f.icuOccupancy).toFixed(4).padStart(6)} | ${r4(f.supplyStress).toFixed(4).padStart(12)} | ${String(f.encounters).padStart(10)} | ${String(f.morgue).padStart(6)} | ${String(f.admissions).padStart(13)}`
  );
}

// ---- B4: staffAvailabilityModifier ----------------------------------------
console.log("\n=== B4  staffAvailabilityModifier ===");
console.log("staffMod | occupancy | encounters | cumAdmissions");
for (const s of [1.0, 0.85]) {
  const f = last(runCase({ staffModifier: s }, 20));
  console.log(`${s.toFixed(2).padStart(8)} | ${r4(f.occupancy).toFixed(4).padStart(9)} | ${String(f.encounters).padStart(10)} | ${String(f.admissions).padStart(13)}`);
}

// ---- B5: full macro packet (what the adapter actually supplies) -----------
console.log("\n=== B5  ADAPTER-EQUIVALENT packet (multiplier 1.3 + pressure 0.4 + natural-disaster) ===");
const adapterEq = last(runCase({ admissionMultiplier: 1.3, supplyChainPressure: 0.4, activeDisaster: "natural-disaster" }, 20));
console.log(`occupancy=${r4(adapterEq.occupancy)} supplyStress=${r4(adapterEq.supplyStress)} encounters=${adapterEq.encounters} morgue=${adapterEq.morgue} cumAdmissions=${adapterEq.admissions}`);
console.log(`vs baseline: Δoccupancy=${r4(adapterEq.occupancy - base.occupancy)} ΔsupplyStress=${r4(adapterEq.supplyStress - baseS.supplyStress)}`);

// ---- D: time-horizon diagnostic -------------------------------------------
console.log("\n=== D  TIME-HORIZON: does the pathway need more than H=20 KE ticks? ===");
console.log("Extreme case (multiplier 2.0 + pressure 1.0 + natural-disaster) vs baseline, at increasing horizons");
console.log("keTick | base occ | ext occ  | Δocc    | base supply | ext supply | Δsupply");
for (const h of [5, 10, 20, 30, 40, 60]) {
  const b = last(runCase({}, h));
  const e = last(runCase({ admissionMultiplier: 2.0, supplyChainPressure: 1.0, activeDisaster: "natural-disaster" }, h));
  console.log(
    `${String(h).padStart(6)} | ${r4(b.occupancy).toFixed(4).padStart(8)} | ${r4(e.occupancy).toFixed(4).padStart(8)} | ${(r4(e.occupancy - b.occupancy)).toFixed(4).padStart(7)} | ${r4(b.supplyStress).toFixed(4).padStart(11)} | ${r4(e.supplyStress).toFixed(4).padStart(10)} | ${(r4(e.supplyStress - b.supplyStress)).toFixed(4)}`
  );
}

// ---- supplyStress trajectory (is it just oscillation about 0.5?) ----------
console.log("\n=== supplyStress trajectory, baseline vs pressure=1.0 (KE ticks 1-20) ===");
const bTraj = runCase({}, 20);
const pTraj = runCase({ supplyChainPressure: 1.0 }, 20);
console.log("keTick | base   | pressure=1.0");
for (let i = 0; i < 20; i++) {
  console.log(`${String(i + 1).padStart(6)} | ${r4(bTraj[i]!.supplyStress).toFixed(4)} | ${r4(pTraj[i]!.supplyStress).toFixed(4)}`);
}

writeFileSync(join(__dirname, "../experiment-results/sentinel-observability/sensitivity-results.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  hospitalId: HOSPITAL_ID, patients: PATIENTS, worldSeed: WORLD_SEED,
  admissionSweep: [1.0, 1.1, 1.3, 1.5, 2.0].map((m) => ({ m, final: last(runCase({ admissionMultiplier: m }, 20)) })),
  pressureSweep: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0].map((p) => ({ p, final: last(runCase({ supplyChainPressure: p }, 20)) })),
  disaster: { none: last(runCase({}, 20)), natural: last(runCase({ activeDisaster: "natural-disaster" }, 20)) },
  staff: [1.0, 0.85].map((s) => ({ s, final: last(runCase({ staffModifier: s }, 20)) })),
  adapterEquivalent: adapterEq,
  horizon: [5, 10, 20, 30, 40, 60].map((h) => ({ h, base: last(runCase({}, h)), extreme: last(runCase({ admissionMultiplier: 2.0, supplyChainPressure: 1.0, activeDisaster: "natural-disaster" }, h)) })),
}, null, 2));
console.log("\nSaved: experiment-results/sentinel-observability/sensitivity-results.json");
console.log("=== END ===");
