/**
 * ADMISSION-THRESHOLD-BOUNDARY-2026-09-10 — EXPLORATORY, NON-CANONICAL
 *
 * Executes docs/experiments/admission-threshold-protocol.md
 * Receiver-boundary experiment: control m=1.3 vs intervention m=1.5,
 * identical DR seed, entered through the existing admission_surge interface.
 *
 * Does NOT modify DR, KE, adapter, admission logic, or flooring.
 * A runner-level read-only RNG wrapper records the first draw per DR tick
 * (used to recover baseAdmit). It does not alter the draw sequence.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createWorld, step } from "../../../../Deers-Rock/dist/index.js";

function arg(name: string, dflt: string): string {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`));
  return p ? p.slice(name.length + 3) : dflt;
}
const SEEDS = arg("seeds", "42,43,44,45,46,47,48,49").split(",").map(Number);
const KE_TICKS = 20;
const TICKS_PER_DAY = 10;
const BEDS = 133;
const PATIENTS = 50;
const M_CONTROL = 1.3;
const M_INTERVENTION = 1.5;
const EXPERIMENT_ID = "ADMISSION-THRESHOLD-BOUNDARY-2026-09-10";

const r4 = (v: number) => Math.round(v * 10000) / 10000;

function runArm(seed: number, m: number) {
  let world = createWorld(PATIENTS, undefined, seed) as any;
  // read-only RNG wrapper: records every draw, never changes the sequence
  let draws: number[] = [];
  const baseRng = world.clock.rng;
  world.clock.rng = () => { const v = baseRng(); draws.push(v); return v; };

  const rows: any[] = [];
  let prevInpatient = 0;
  for (let kt = 1; kt <= KE_TICKS; kt++) {
    world.queue.schedule("admission_surge", 0, { multiplier: m });
    for (let i = 0; i < TICKS_PER_DAY; i++) {
      draws = [];
      world = step(world);
      const baseAdmit = draws.length ? Math.floor(draws[0]! * 3) : -1;
      let inpatient = 0;
      for (const e of world.state.encounters.values()) if ((e as any).type === "inpatient") inpatient++;
      let activePatients = 0;
      for (const e of world.state.encounters.values()) if ((e as any).status === "active") activePatients++;
      const occupied = [...world.state.beds.values()].filter((b: any) => b.patientId !== null).length;
      rows.push({
        keTick: kt,
        drTick: world.clock.tick,
        baseAdmit,
        expectedToAdmit: Math.min(BEDS, Math.max(1, Math.floor(baseAdmit * m))),
        admissions: inpatient - prevInpatient,
        cumulativeAdmissions: inpatient,
        occupied,
        occupancyRate: r4(occupied / BEDS),
        rngDraws: draws.length,
        _admissionMultiplier: world.state._admissionMultiplier,
        totalPatients: world.state.patients.size,
        activeEncounters: activePatients,
      });
      prevInpatient = inpatient;
    }
  }
  return { seed, m, rows, totalAdmissions: prevInpatient };
}

const t0 = Date.now();
const pairs: any[] = [];
for (const seed of SEEDS) {
  const control = runArm(seed, M_CONTROL);
  const intervention = runArm(seed, M_INTERVENTION);
  const cRows = control.rows, iRows = intervention.rows;

  // invariant: find first DR tick where rows differ (excluding the multiplier field)
  let firstDivergence: number | null = null;
  const n = Math.min(cRows.length, iRows.length);
  for (let k = 0; k < n; k++) {
    const c = cRows[k], i = iRows[k];
    const same = c.baseAdmit === i.baseAdmit && c.admissions === i.admissions &&
      c.cumulativeAdmissions === i.cumulativeAdmissions && c.occupied === i.occupied;
    if (!same) { firstDivergence = c.drTick; break; }
  }

  const baseAdmit2Ticks = cRows.filter((r: any) => r.baseAdmit === 2).length;
  const diffTicks = cRows.filter((r: any, k: number) => r.admissions !== iRows[k].admissions).length;
  const deltaAdmissions = intervention.totalAdmissions - control.totalAdmissions;

  pairs.push({
    seed,
    control: { totalAdmissions: control.totalAdmissions, baseAdmit2Ticks, rows: cRows },
    intervention: { totalAdmissions: intervention.totalAdmissions, baseAdmit2Ticks: iRows.filter((r: any) => r.baseAdmit === 2).length, rows: iRows },
    invariant: {
      firstDivergenceDrTick: firstDivergence,
      identicalBeforeDivergence: firstDivergence === null ? true : cRows.slice(0, cRows.findIndex((r: any) => r.drTick === firstDivergence)).every((c: any, k: number) => c.baseAdmit === iRows[k].baseAdmit && c.admissions === iRows[k].admissions),
    },
    summary: {
      controlBaseAdmit2Ticks: baseAdmit2Ticks,
      ticksWithAdmissionDifference: diffTicks,
      deltaAdmissions,
      expectedDeltaIfSynced: baseAdmit2Ticks,
      reconcilesExactly: deltaAdmissions === baseAdmit2Ticks,
    },
  });
  console.log(`seed ${seed}: ctlAdm=${control.totalAdmissions} intAdm=${intervention.totalAdmissions} Δ=${deltaAdmissions} N(baseAdmit=2,ctl)=${baseAdmit2Ticks} diffTicks=${diffTicks} firstDiv=${firstDivergence}`);
}

let keCommit = "unknown", drCommit = "unknown";
try { keCommit = execSync("git rev-parse HEAD", { cwd: join(dirname(fileURLToPath(import.meta.url)), "../../..") }).toString().trim(); } catch { /* */ }
try { drCommit = execSync("git rev-parse HEAD", { cwd: "/root/Deers-Rock" }).toString().trim(); } catch { /* */ }

const out = {
  experimentId: EXPERIMENT_ID,
  protocol: "docs/experiments/admission-threshold-protocol.md",
  exploratory: true,
  canonical: false,
  disclaimer: "EXPLORATORY — NON-CANONICAL. Receiver-sensitivity characterization, NOT a macro-causal experiment.",
  executedAt: new Date().toISOString(),
  durationSec: r4((Date.now() - t0) / 1000),
  environment: { keCommit, drCommit, node: process.version, platform: process.platform, arch: process.arch },
  parameters: { seeds: SEEDS, mControl: M_CONTROL, mIntervention: M_INTERVENTION, keTicks: KE_TICKS, ticksPerDay: TICKS_PER_DAY, beds: BEDS, patients: PATIENTS },
  pairs,
};
const outDir = join(dirname(fileURLToPath(import.meta.url)), "../../../docs/experiments");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "admission-threshold-results.json"), JSON.stringify(out, null, 2));
console.log(`\ndone in ${out.durationSec}s -> docs/experiments/admission-threshold-results.json`);
