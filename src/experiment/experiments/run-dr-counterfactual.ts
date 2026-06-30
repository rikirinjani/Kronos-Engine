import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runExperiment } from "./dr-counterfactual.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedCount = 30;
const seeds = Array.from({ length: seedCount }, (_, i) => 42 + i);

console.log(`Running DR counterfactual with ${seedCount} seeds...`);
const experiment = runExperiment(seeds);

const outDir = join(__dirname, "../../../experiment-results/dr-counterfactual");
writeFileSync(join(outDir, "p004-30seeds-summary.json"), JSON.stringify(experiment.summary, null, 2));
writeFileSync(join(outDir, "p004-30seeds-runs.json"), JSON.stringify(experiment.runs, null, 2));

console.log(`Done. ${experiment.numSeeds} seeds, ${experiment.summary.metrics.length} metrics.`);
const sig = experiment.summary.metrics.filter(m => m.significant);
console.log(`Significant: ${sig.length}`);

const drMetrics = sig.filter(m => m.path.includes("deers-rock") || m.path.includes("sentinel") || m.path.includes("health.") || m.path.includes("admission") || m.path.includes("occupancy") || m.path.includes("mortality"));
console.log(`DR-specific significant: ${drMetrics.length}`);

for (const m of sig.sort((a, b) => Math.abs(b.cohensD) - Math.abs(a.cohensD)).slice(0, 25)) {
  const dir = m.mean > 0 ? "+" : "";
  console.log(`  ${m.path}: Δ=${dir}${m.mean.toFixed(2)} d=${m.cohensD.toFixed(2)} sig=${m.significant}`);
}
