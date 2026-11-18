import { performance } from 'perf_hooks';
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const RESULTS_DIR = '/root/Kronos-Engine/experiment-results/mc-benchmark';
if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

// ── Seed configurations ──
const SEED_SETS = [
  { label: '1-seed', seeds: [42] },
  { label: '5-seeds', seeds: [42,43,44,45,46] },
  { label: '10-seeds', seeds: [42,43,44,45,46,47,48,49,50,51] },
  { label: '30-seeds', seeds: Array.from({length:30}, (_,i) => 42+i) },
];

function getMemoryMB() {
  try {
    const out = execSync("free -m | grep Mem | awk '{print $3}'", { encoding: 'utf8' }).trim();
    return parseInt(out) || 0;
  } catch { return 0; }
}

function getCPUCores() {
  try {
    return parseInt(execSync('nproc', { encoding: 'utf8' }).trim()) || 1;
  } catch { return 1; }
}

// ── System info ──
const nodeVer = process.version;
const cpuModel = execSync("lscpu | grep 'Model name' | sed 's/Model name:\\s*//'", { encoding: 'utf8' }).trim();
const totalMem = execSync("free -m | grep Mem | awk '{print $2}'", { encoding: 'utf8' }).trim();
const cpuCores = getCPUCores();
const cpuFreq = execSync("lscpu | grep 'CPU MHz' | awk '{print $3}'", { encoding: 'utf8' }).trim();

console.log('╔══════════════════════════════════════════════╗');
console.log('║  KE PHASE 1 — BASELINE BENCHMARK            ║');
console.log('╚══════════════════════════════════════════════╝');
console.log(`Date:         ${new Date().toISOString()}`);
console.log(`Node:         ${nodeVer}`);
console.log(`CPU:          ${cpuModel}`);
console.log(`CPU cores:    ${cpuCores}`);
console.log(`CPU freq:     ${cpuFreq} MHz`);
console.log(`Total RAM:    ${totalMem} MB`);
console.log('');

const results = [];

for (const run of SEED_SETS) {
  const n = run.seeds.length;
  const seedArg = run.seeds.join(',');
  
  console.log(`── ${run.label} (${n} seeds) ──`);
  
  const memBefore = getMemoryMB();
  const t0 = performance.now();
  
  try {
    execSync(
      `node dist/experiment/experiments/dr-counterfactual.js --seeds=${seedArg} --horizon=20`,
      { cwd: '/root/Kronos-Engine', timeout: 600000, stdio: 'pipe' }
    );
  } catch (e) {
    const msg = e.stderr ? e.stderr.toString().substring(0, 300) : e.message.substring(0, 300);
    console.log(`  ERROR: ${msg}`);
    results.push({ label: run.label, seeds: n, error: msg });
    continue;
  }
  
  const t1 = performance.now();
  const memAfter = getMemoryMB();
  
  const wallSec = (t1 - t0) / 1000;
  const simsPerSec = n / wallSec;
  const simsPerMin = simsPerSec * 60;
  const perSimMs = (wallSec / n) * 1000;
  
  console.log(`  Wall time:       ${wallSec.toFixed(1)}s`);
  console.log(`  Sims/sec:        ${simsPerSec.toFixed(4)}`);
  console.log(`  Sims/min:        ${simsPerMin.toFixed(2)}`);
  console.log(`  Per-sim:         ${perSimMs.toFixed(0)}ms`);
  console.log(`  Memory:          ${memBefore}MB → ${memAfter}MB (Δ${memAfter - memBefore}MB)`);
  console.log('');
  
  results.push({
    label: run.label,
    seeds: n,
    wallSec: +wallSec.toFixed(2),
    simsPerSec: +simsPerSec.toFixed(4),
    simsPerMin: +simsPerMin.toFixed(2),
    perSimMs: +perSimMs.toFixed(0),
    memBeforeMB: memBefore,
    memAfterMB: memAfter,
    memDeltaMB: memAfter - memBefore,
  });
}

// ── Projections ──
console.log('═══════════════════════════════════════════════');
console.log('  PROJECTED RUNTIMES & COSTS');
console.log('═══════════════════════════════════════════════');

// Use the 30-seed result as baseline, or fall back to 10-seed
const baseline = results.find(r => r.seeds === 30) || results.find(r => r.seeds === 10) || results.find(r => r.seeds === 5);
if (baseline && !baseline.error) {
  const simsPerSec = baseline.simsPerSec;
  const perSimSec = baseline.wallSec / baseline.seeds;
  
  // Vultr estimated cost (placeholder — will fill when pricing known)
  const COST_PER_HOUR = null; // TODO: fill from Phase 0
  
  const targets = [100, 1000, 10000, 50000, 100000, 500000];
  
  console.log(`Baseline:     ${baseline.seeds} seeds in ${baseline.wallSec}s → ${simsPerSec.toFixed(4)} sims/sec`);
  console.log('');
  console.log(`${'Sims'.padStart(10)} | ${'Wall Time'.padStart(12)} | ${'CPU-hrs'.padStart(10)} | ${'Cost'.padStart(10)}`);
  console.log(`${'─'.repeat(10)} | ${'─'.repeat(12)} | ${'─'.repeat(10)} | ${'─'.repeat(10)}`);
  
  for (const target of targets) {
    const wallSec = perSimSec * target;
    const wallHrs = wallSec / 3600;
    const cpuHrs = wallHrs * cpuCores;
    const cost = COST_PER_HOUR ? (cpuHrs * COST_PER_HOUR).toFixed(2) : 'TBD';
    
    let wallStr;
    if (wallSec < 60) wallStr = `${wallSec.toFixed(0)}s`;
    else if (wallSec < 3600) wallStr = `${(wallSec/60).toFixed(1)}min`;
    else wallStr = `${(wallSec/3600).toFixed(1)}hr`;
    
    console.log(`${String(target).padStart(10)} | ${wallStr.padStart(12)} | ${cpuHrs.toFixed(2).padStart(10)} | $${cost.padStart(8)}`);
  }
} else {
  console.log('No baseline result available for projections.');
}

// ── Write results ──
const output = {
  timestamp: new Date().toISOString(),
  system: { cpuModel, cpuCores, cpuFreq, totalMemMB: +totalMem, nodeVer },
  baseline: results,
  projections: baseline && !baseline.error ? {
    perSimSec: +(baseline.wallSec / baseline.seeds).toFixed(4),
    simsPerSec: baseline.simsPerSec,
  } : null,
};

const outPath = `${RESULTS_DIR}/phase1-benchmark.json`;
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nResults written to: ${outPath}`);
