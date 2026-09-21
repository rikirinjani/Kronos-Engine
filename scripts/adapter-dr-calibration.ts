/**
 * ADAPTER–DR INTERFACE CALIBRATION (diagnostic only).
 *
 * Establishes the EXISTING Deers Rock response function for each adapter-facing
 * parameter. This is a model characterisation, NOT adapter tuning.
 * No production code modified. No DR thresholds changed. No scenario severity changed.
 *
 * Run: npx tsx scripts/adapter-dr-calibration.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createWorld, step, computeSupplyStress } from "../../Deers-Rock/dist/index.js";
import { getHospitalSeed } from "../src/sectors/deers-rock-adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATIENTS = 50, WORLD_SEED = 42, HOSPITAL_ID = "makassar-001", TICKS_PER_KE = 10;
const KE_TICKS = 20; // 200 DR ticks

function hospitalSeed(): number {
  let h = 0;
  for (let i = 0; i < HOSPITAL_ID.length; i++) { h = ((h << 5) - h) + HOSPITAL_ID.charCodeAt(i); h |= 0; }
  return getHospitalSeed(WORLD_SEED, Math.abs(h) || 1);
}

interface Macro { admissionMultiplier?: number; supplyChainPressure?: number; activeDisaster?: string; }
interface Row {
  keTick: number; occupancy: number; icuOccupancy: number; supplyStress: number;
  encounters: number; morgue: number; cumAdm: number; cumDisch: number;
  scenario: string | null; scenarioSeverity: number | null; scenarioPhase: string | null;
  topIcd: string | null;
}

function runCase(macro: Macro, keTicks = KE_TICKS): Row[] {
  let world = createWorld(PATIENTS, undefined, hospitalSeed());
  const out: Row[] = [];
  let prevOcc = 0, cumAdm = 0, cumDisch = 0;

  for (let k = 0; k < keTicks; k++) {
    for (let i = 0; i < TICKS_PER_KE; i++) {
      if (i === 0) {
        if (macro.admissionMultiplier !== undefined && macro.admissionMultiplier !== 1.0)
          world.queue.schedule("admission_surge", 0, { multiplier: macro.admissionMultiplier });
        if (macro.supplyChainPressure !== undefined && macro.supplyChainPressure > 0)
          world.queue.schedule("supply_chain_pressure", 0, { pressure: macro.supplyChainPressure });
        if (macro.activeDisaster) world.queue.schedule("active_disaster", 0, { disasterType: macro.activeDisaster });
      }
      world = step(world);
    }
    const st = world.state as any;
    let occ = 0, icu = 0;
    for (const b of st.beds.values()) {
      if (b.patientId) { occ++; if (b.ward === "ICU" || b.ward === "PICU" || b.ward === "NICU") icu++; }
    }
    const totalCap = Object.values(st.wardCapacity).reduce((a: number, b: any) => a + b, 0) as number;
    const icuCap = (st.wardCapacity["ICU"] ?? 0) + (st.wardCapacity["PICU"] ?? 0) + (st.wardCapacity["NICU"] ?? 0);
    if (occ > prevOcc) cumAdm += occ - prevOcc; else if (occ < prevOcc) cumDisch += prevOcc - occ;
    prevOcc = occ;

    const icd: Record<string, number> = {};
    for (const e of st.encounters.values()) {
      const c = (e as any).primaryDiagnosis ?? "UNKNOWN";
      icd[c] = (icd[c] ?? 0) + 1;
    }
    const topIcd = Object.entries(icd).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
    const sc = st._scenario;

    out.push({
      keTick: k + 1,
      occupancy: totalCap > 0 ? occ / totalCap : 0,
      icuOccupancy: icuCap > 0 ? icu / icuCap : 0,
      supplyStress: computeSupplyStress(st),
      encounters: st.encounters.size,
      morgue: st.morgue instanceof Array ? st.morgue.length : 0,
      cumAdm, cumDisch,
      scenario: sc?.active?.type ?? null,
      scenarioSeverity: sc?.active?.severity ?? null,
      scenarioPhase: sc?.active?.phase ?? null,
      topIcd,
    });
  }
  return out;
}

const fin = (r: Row[]) => r[r.length - 1]!;
const r4 = (v: number) => Math.round(v * 10000) / 10000;
const base = runCase({});
const baseFin = fin(base);

mkdirSync(join(__dirname, "../experiment-results/adapter-dr-calibration"), { recursive: true });

console.log("=== ADAPTER–DR INTERFACE CALIBRATION ===");
console.log(`hospital=${HOSPITAL_ID} patients=${PATIENTS} seed=${WORLD_SEED} horizon=${KE_TICKS} KE ticks (${KE_TICKS * TICKS_PER_KE} DR ticks)`);
console.log(`baseline (no macro): occ=${r4(baseFin.occupancy)} icu=${r4(baseFin.icuOccupancy)} supply=${r4(baseFin.supplyStress)} enc=${baseFin.encounters} adm=${baseFin.cumAdm} disch=${baseFin.cumDisch} morgue=${baseFin.morgue}`);
console.log();

// ---- A1: admissionMultiplier (specified grid + fine scan) ------------------
console.log("=== A1  admissionMultiplier ===");
console.log("mult | occupancy | Δocc    | icuOcc | Δicu    | encounters | cumAdm | cumDisch | morgue | supplyStress");
const admGrid = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2.0];
const admResults: Record<string, Row> = {};
for (const m of admGrid) {
  const f = fin(runCase({ admissionMultiplier: m }));
  admResults[m.toFixed(2)] = f;
  console.log(
    `${m.toFixed(2)} | ${r4(f.occupancy).toFixed(4).padStart(9)} | ${(r4(f.occupancy - baseFin.occupancy)).toFixed(4).padStart(7)} | ${r4(f.icuOccupancy).toFixed(4).padStart(6)} | ${(r4(f.icuOccupancy - baseFin.icuOccupancy)).toFixed(4).padStart(7)} | ${String(f.encounters).padStart(10)} | ${String(f.cumAdm).padStart(6)} | ${String(f.cumDisch).padStart(8)} | ${String(f.morgue).padStart(6)} | ${r4(f.supplyStress).toFixed(4)}`
  );
}

console.log("\n--- A1b fine scan 1.40..1.60 step 0.02 (onset localisation) ---");
console.log("mult  | occupancy | cumAdm | encounters");
let admOnset: string | null = null;
for (let m = 1.40; m <= 1.6001; m += 0.02) {
  const f = fin(runCase({ admissionMultiplier: Math.round(m * 100) / 100 }));
  const changed = f.cumAdm !== baseFin.cumAdm;
  if (changed && !admOnset) admOnset = m.toFixed(2);
  console.log(`${m.toFixed(2)}  | ${r4(f.occupancy).toFixed(4).padStart(9)} | ${String(f.cumAdm).padStart(6)} | ${String(f.encounters).padStart(10)}${changed ? "  <-- changed" : ""}`);
}

// ---- A2: supplyChainPressure ----------------------------------------------
console.log("\n=== A2  supplyChainPressure ===");
console.log("press | occupancy | supplyStress | Δsupply | encounters | cumAdm");
const pressGrid = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0];
const pressResults: Record<string, Row> = {};
for (const p of pressGrid) {
  const f = fin(runCase({ supplyChainPressure: p }));
  pressResults[p.toFixed(2)] = f;
  console.log(
    `${p.toFixed(2)}  | ${r4(f.occupancy).toFixed(4).padStart(9)} | ${r4(f.supplyStress).toFixed(4).padStart(12)} | ${(r4(f.supplyStress - baseFin.supplyStress)).toFixed(4).padStart(7)} | ${String(f.encounters).padStart(10)} | ${String(f.cumAdm).padStart(6)}`
  );
}

console.log("\n--- A2b fine scan 0.40..0.70 step 0.025 (onset localisation) ---");
console.log("press  | supplyStress | Δsupply");
let pressOnset: string | null = null;
for (let p = 0.40; p <= 0.7001; p += 0.025) {
  const f = fin(runCase({ supplyChainPressure: Math.round(p * 1000) / 1000 }));
  const changed = Math.abs(f.supplyStress - baseFin.supplyStress) > 0.01;
  if (changed && !pressOnset) pressOnset = p.toFixed(3);
  console.log(`${p.toFixed(3)}  | ${r4(f.supplyStress).toFixed(4).padStart(12)} | ${(r4(f.supplyStress - baseFin.supplyStress)).toFixed(4).padStart(7)}${changed ? "  <-- changed" : ""}`);
}

// ---- A3: activeDisasterType ------------------------------------------------
console.log("\n=== A3  activeDisasterType ===");
console.log("case              | scenario       | sev  | phase     | occ    | icuOcc | encounters | morgue | supply");
for (const [label, macro] of [["inactive", {}], ["active", { activeDisaster: "natural-disaster" }]] as [string, Macro][]) {
  const r = runCase(macro);
  const f = fin(r);
  const firstSc = r.find((x) => x.scenario);
  console.log(
    `${label.padEnd(17)} | ${String(f.scenario).padEnd(14)} | ${String(f.scenarioSeverity).padEnd(4)} | ${String(f.scenarioPhase).padEnd(9)} | ${r4(f.occupancy).toFixed(4)} | ${r4(f.icuOccupancy).toFixed(4)} | ${String(f.encounters).padStart(10)} | ${String(f.morgue).padStart(6)} | ${r4(f.supplyStress).toFixed(4)}`
  );
  console.log(`  first scenario at KE tick ${firstSc?.keTick ?? "-"}, type=${firstSc?.scenario}, severity=${firstSc?.scenarioSeverity}`);
}

// ---- B: trajectories -------------------------------------------------------
console.log("\n=== B  TRAJECTORIES (occupancy) ===");
const trajAdm = { "1.0": runCase({ admissionMultiplier: 1.0 }), "1.3": runCase({ admissionMultiplier: 1.3 }), "1.5": runCase({ admissionMultiplier: 1.5 }), "2.0": runCase({ admissionMultiplier: 2.0 }) };
console.log("keTick | m=1.0  | m=1.3  | m=1.5  | m=2.0");
for (let i = 0; i < KE_TICKS; i++) {
  console.log(`${String(i + 1).padStart(6)} | ${r4(trajAdm["1.0"]![i]!.occupancy).toFixed(4)} | ${r4(trajAdm["1.3"]![i]!.occupancy).toFixed(4)} | ${r4(trajAdm["1.5"]![i]!.occupancy).toFixed(4)} | ${r4(trajAdm["2.0"]![i]!.occupancy).toFixed(4)}`);
}

console.log("\n=== B  TRAJECTORIES (supplyStress) ===");
const trajP = { "0.0": runCase({ supplyChainPressure: 0.0 }), "0.4": runCase({ supplyChainPressure: 0.4 }), "0.5": runCase({ supplyChainPressure: 0.5 }), "1.0": runCase({ supplyChainPressure: 1.0 }) };
console.log("keTick | p=0.0  | p=0.4  | p=0.5  | p=1.0");
for (let i = 0; i < KE_TICKS; i++) {
  console.log(`${String(i + 1).padStart(6)} | ${r4(trajP["0.0"]![i]!.supplyStress).toFixed(4)} | ${r4(trajP["0.4"]![i]!.supplyStress).toFixed(4)} | ${r4(trajP["0.5"]![i]!.supplyStress).toFixed(4)} | ${r4(trajP["1.0"]![i]!.supplyStress).toFixed(4)}`);
}

// ---- F: calibration summary -----------------------------------------------
console.log("\n=== F  CALIBRATION SUMMARY ===");
console.log(`ADMISSION channel:`);
console.log(`  lower threshold (first change): ${admOnset ?? "not observed in 1.40-1.60"}`);
console.log(`  quantization: floor(baseAdmit * m), baseAdmit = floor(rng()*3) in {0,1,2}`);
console.log(`  analytic threshold: m >= 1.5 changes baseAdmit=2; m >= 2.0 changes baseAdmit=1`);
console.log(`  responsive region: 1.5 .. 2.0+  (adapter supplies 1.3 -> below threshold)`);
console.log(`  saturation: occupancy ${r4(admResults["1.00"]!.occupancy)} (m=1.0) -> ${r4(admResults["2.00"]!.occupancy)} (m=2.0)`);
console.log(`PRESSURE channel:`);
console.log(`  lower threshold (first change): ${pressOnset ?? "not observed in 0.40-0.70"}`);
console.log(`  responsive region: >= ${pressOnset ?? "?"} (adapter supplies 0.4 -> below threshold)`);
console.log(`  saturation: supplyStress floor at ${r4(pressResults["1.00"]!.supplyStress)}`);
console.log(`DISASTER channel: categorical (type only); severity fixed at 0.6`);

writeFileSync(join(__dirname, "../experiment-results/adapter-dr-calibration/calibration-results.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  hospitalId: HOSPITAL_ID, patients: PATIENTS, worldSeed: WORLD_SEED,
  horizonKeTicks: KE_TICKS, drTicks: KE_TICKS * TICKS_PER_KE,
  baseline: baseFin,
  admissionGrid: admGrid.map((m) => ({ m, final: admResults[m.toFixed(2)] })),
  admissionOnset: admOnset,
  pressureGrid: pressGrid.map((p) => ({ p, final: pressResults[p.toFixed(2)] })),
  pressureOnset: pressOnset,
  disaster: { inactive: fin(runCase({})), active: fin(runCase({ activeDisaster: "natural-disaster" })) },
  trajectories: { admissionOccupancy: trajAdm, pressureSupply: trajP },
}, null, 2));
console.log("\nSaved: experiment-results/adapter-dr-calibration/calibration-results.json");
console.log("=== END ===");
