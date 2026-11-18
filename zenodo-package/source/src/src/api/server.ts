import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compareSectorStates } from "../experiment/diff-engine.js";
import { computeSummary } from "../experiment/stats.js";
import { loadEraAndRun } from "../engine/experiment-runner.js";
import { createEconomySector } from "../sectors/economy.js";
import { createClimateSector } from "../sectors/climate.js";
import { createGeopoliticsSector } from "../sectors/geopolitics.js";
import { createTechnologySector } from "../sectors/technology.js";
import { createEnergySector } from "../sectors/energy.js";
import { createDemographicsSector } from "../sectors/demographics.js";
import type { Sector, SectorState } from "../sectors/types.js";
import type { ExperimentRun, Intervention, CounterfactualDiff, SectorDiff, MetricDelta } from "../experiment/types.js";
import { createEventBus } from "../sectors/event-bus.js";

const PORT = Number(process.env.PORT) || 3001;
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");
const HISTORY_DIR = join(PROJECT_ROOT, "docs", "history");
const startTime = Date.now();

const ALL_SECTORS: Sector[] = [
  createGeopoliticsSector(), createClimateSector(), createEconomySector(),
  createTechnologySector(), createEnergySector(), createDemographicsSector(),
];

interface EraInfo { era: string; label: string; file: string; rewindPoints: string[] }
interface CachedExperiment {
  id: string; label: string; intervention: Intervention;
  rewindPointId: string; ticks: number; numSeeds: number;
  status: "running" | "done" | "failed"; progress: number;
  createdAt: string; runs: ExperimentRun[]; summary: Record<string, unknown> | null; error?: string;
}

function loadEraIndex(): EraInfo[] {
  if (!existsSync(HISTORY_DIR)) return [];
  return readdirSync(HISTORY_DIR).filter((f) => f.startsWith("era-") && f.endsWith(".json") && f !== "era-future-defaults.json").map((f) => {
    try {
      const c = JSON.parse(readFileSync(join(HISTORY_DIR, f), "utf-8"));
      const era = f.replace("era-", "").replace(".json", "");
      return { era, label: c.meta?.label ?? era, file: join(HISTORY_DIR, f), rewindPoints: Object.keys(c.states ?? {}).sort() };
    } catch { return { era: f, label: f, file: join(HISTORY_DIR, f), rewindPoints: [] as string[] }; }
  });
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}")); } catch { reject(new Error("Invalid JSON")); } });
    req.on("error", reject);
  });
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
  res.end(JSON.stringify(data, null, 2));
}

function computeDiffFromSnapshots(parentSectors: Array<{ id: string; state: SectorState }>, branchSectors: Array<{ id: string; state: SectorState }>, branchId: string, parentUniverseId: string, rewindTick: number, currentTick: number): CounterfactualDiff {
  const parentMap = new Map(parentSectors.map((s) => [s.id, s.state]));
  const branchMap = new Map(branchSectors.map((s) => [s.id, s.state]));
  const perSector: Record<string, SectorDiff> = {};
  const emptyEvents = createEventBus();
  for (const [id, parentState] of parentMap) {
    const branchState = branchMap.get(id);
    if (branchState) perSector[id] = compareSectorStates(parentState, branchState, [], []);
  }
  return { branchId, parentUniverseId, rewindTick, currentTick, totalTicksElapsed: currentTick - rewindTick, capturedAt: new Date().toISOString(), perSector };
}

const cache = new Map<string, CachedExperiment>();
let counter = 0;
const OPTIONS_RESPONSE = { ok: true };

async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname.replace(/\/$/, "") || "/";
  const method = req.method ?? "GET";

  try {
    if (method === "OPTIONS") { json(res, OPTIONS_RESPONSE); return; }

    if (path === "/" && method === "GET") {
      const indexPath = join(__dirname, "index.html");
      if (existsSync(indexPath)) {
        const html = readFileSync(indexPath, "utf-8");
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
      } else {
        json(res, { error: "index.html not found" }, 404);
      }
      return;
    }

    if (path === "/api/status" && method === "GET") {
      json(res, { ok: true, version: "0.1.0", uptime: Math.floor((Date.now() - startTime) / 1000), sectors: ALL_SECTORS.map((s) => s.id).sort(), numEras: loadEraIndex().length, experiments: cache.size });
      return;
    }

    if (path === "/api/sectors" && method === "GET") {
      json(res, { sectors: ALL_SECTORS.map((s) => ({ id: s.id, name: s.name, cadence: s.cadence, events: s.events, handlers: s.handlers.map((h) => h.eventType) })) });
      return;
    }

    if (path === "/api/eras" && method === "GET") {
      json(res, { eras: loadEraIndex() });
      return;
    }

    if (path === "/api/experiments" && method === "GET") {
      const list = Array.from(cache.values()).map((e) => ({ id: e.id, label: e.label, status: e.status, interventionType: e.intervention.type, rewindPointId: e.rewindPointId, ticks: e.ticks, numSeeds: e.numSeeds, progress: e.progress, createdAt: e.createdAt }));
      json(res, { experiments: list.reverse() });
      return;
    }

    if (path === "/api/experiments" && method === "POST") {
      const body = await readBody(req);
      const rpId = String(body.rewindPointId ?? "");
      if (!rpId) { json(res, { error: "rewindPointId is required" }, 400); return; }
      const era = String(body.era ?? "contemporary");
      const ticks = Number(body.ticks ?? 20);
      const numSeeds = Number(body.numSeeds ?? 3);
      const intervention: Intervention = (body.intervention as Intervention) ?? { type: "custom", label: "Custom", description: "", params: {} };
      const eras = loadEraIndex();
      const eraInfo = eras.find((e) => e.era === era) ?? eras.find((e) => e.rewindPoints.includes(rpId));
      if (!eraInfo || !eraInfo.rewindPoints.includes(rpId)) { json(res, { error: `Rewind point "${rpId}" not found` }, 400); return; }
      const id = `exp-${Date.now()}-${++counter}`;
      const exp: CachedExperiment = { id, label: String(body.label ?? `${rpId} x ${numSeeds}`), intervention, rewindPointId: rpId, ticks, numSeeds, status: "running", progress: 0, createdAt: new Date().toISOString(), runs: [], summary: null };
      cache.set(id, exp);
      json(res, { experimentId: id, status: "queued" }, 202);
      runInBackground(exp, eraInfo, ticks, numSeeds, intervention);
      return;
    }

    const expMatch = path.match(/^\/api\/experiments\/([a-zA-Z0-9-]+)$/);
    if (expMatch && method === "GET") {
      const exp = cache.get(expMatch[1]!);
      if (!exp) { json(res, { error: "Not found" }, 404); return; }
      json(res, { experiment: exp });
      return;
    }

    const exportMatch = path.match(/^\/api\/export\/([a-zA-Z0-9-]+)\/(json|csv)$/);
    if (exportMatch && method === "GET") {
      const exp = cache.get(exportMatch[1]!);
      if (!exp) { json(res, { error: "Not found" }, 404); return; }
      if (exportMatch[2] === "json") { json(res, exp); return; }
      const header = ["runId,seed,sector,metric,parentValue,branchValue,delta,relativeDelta"];
      const body: string[] = [];
      for (const run of exp.runs) {
        for (const [sid, sd] of Object.entries(run.diff.perSector)) {
          for (const m of sd.metrics) {
            body.push(`"${run.runId}",${run.seed},"${sid}","${m.path}",${m.parentValue},${m.branchValue},${m.absoluteDelta},${m.relativeDelta}`);
          }
        }
      }
      res.writeHead(200, { "Content-Type": "text/csv", "Access-Control-Allow-Origin": "*", "Content-Disposition": `attachment; filename="${exp.id}.csv"` });
      res.end([...header, ...body].join("\n"));
      return;
    }

    json(res, { error: "Not found" }, 404);
  } catch (err: unknown) {
    json(res, { error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
}

async function runInBackground(exp: CachedExperiment, eraInfo: EraInfo, ticks: number, numSeeds: number, intervention: Intervention): Promise<void> {
  try {
    for (let i = 0; i < numSeeds; i++) {
      const seed = 42 + i;
      const parentResult = loadEraAndRun(eraInfo.file, exp.rewindPointId, { ticks, sectors: ALL_SECTORS, seed });
      const branchResult = loadEraAndRun(eraInfo.file, exp.rewindPointId, { ticks, sectors: ALL_SECTORS, seed: seed + 10000 });
      const diff = computeDiffFromSnapshots(parentResult.snapshot.sectors, branchResult.snapshot.sectors, `branch-${seed}`, `universe-${seed}`, 0, ticks);
      exp.runs.push({ runId: `run-${seed}`, seed, rewindTick: 0, totalTicks: ticks, intervention, diff, createdAt: new Date().toISOString() });
      exp.progress = Math.round(((i + 1) / numSeeds) * 10) * 10;
    }
    const summary = computeSummary(exp.runs, intervention);
    exp.summary = { n: summary.n, seeds: summary.seeds, rewindTick: summary.rewindTick, totalTicks: summary.totalTicks, intervention: summary.intervention, metrics: summary.metrics.map((m) => ({ name: m.name, path: m.path, mean: m.mean, stdDev: m.stdDev, cohensD: m.cohensD, significant: m.significant })), generatedAt: summary.generatedAt, numSeeds };
    exp.status = "done";
    exp.progress = 100;
  } catch (err: unknown) {
    exp.status = "failed";
    exp.error = err instanceof Error ? err.message : String(err);
  }
}

const httpServer = createServer(handler);

export function start(port = PORT): Promise<void> {
  return new Promise((resolve) => { httpServer.listen(port, resolve); });
}

export function stop(): Promise<void> {
  return new Promise((resolve) => httpServer.close(() => resolve()));
}

const isMain = process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js");
if (isMain) {
  start().then(() => {
    console.log(`Kronos Engine API — http://localhost:${PORT}`);
    console.log(`  Sectors: ${ALL_SECTORS.map((s) => s.id).join(", ")}`);
    console.log(`  Eras: ${loadEraIndex().length} found`);
  });
}
