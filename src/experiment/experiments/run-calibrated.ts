import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runExperiment } from "./wwii-no-war.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedCount = 30;
const seeds = Array.from({ length: seedCount }, (_, i) => 42 + i);

console.log(`Running P-003 calibrated with ${seedCount} seeds...`);
const experiment = runExperiment(seeds);

const outDir = join(__dirname, "../../../experiment-results/wwii-counterfactual");
writeFileSync(join(outDir, "p003-calibrated-summary.json"), JSON.stringify(experiment.summary, null, 2));
writeFileSync(join(outDir, "p003-calibrated-runs.json"), JSON.stringify(experiment.runs, null, 2));

console.log(`Done. ${experiment.numSeeds} seeds, ${experiment.summary.metrics.length} metrics.`);
const sig = experiment.summary.metrics.filter(m => m.significant);
console.log(`Significant: ${sig.length}`);

const gdpSig = sig.filter(m => m.path.includes("gdp") && !m.path.includes("GrowthRate"));
console.log(`Significant GDP metrics: ${gdpSig.length}`);
for (const m of gdpSig) {
  console.log(`  ${m.path}: Δ=${m.mean.toFixed(0)} d=${m.cohensD.toFixed(2)}`);
}
