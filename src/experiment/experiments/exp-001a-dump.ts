import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { deersRockAdapter } from "../../sectors/deers-rock-adapter.js";
import type { Sector } from "../../sectors/types.js";
import { createWorld, tick, snapshot, resetUniverseCounter } from "../../engine/index.js";

const SENTINEL = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };

function loadEraState(eraFile: string, rpId: string): any {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const raw = JSON.parse(readFileSync(join(__dirname, `../../../docs/history/${eraFile}`), "utf-8"));
  return raw.states[rpId];
}
function buildSectorConfigs(era: any) {
  const economyNations: any = {}; const techNations: any = {};
  for (const n of era.nations) {
    economyNations[n.id] = { gdp: n.gdp, gdpGrowthRate: 2.5, inflationRate: 3.0, tradeVolume: 50, unemploymentRate: 5.0 };
    techNations[n.id] = { technologyLevel: n.technologyLevel, rdSpending: 0.01 + (n.technologyLevel / 100) * 0.025 };
  }
  return {
    geopolitics: { nations: era.nations, wars: era.wars, alliances: era.alliances, globalState: era.globalState, year: era.year, casualtyMultiplier: 1 },
    climate: { co2Concentration: 420, annualEmissions: 37, year: era.year, annualEmissionsNoise: 0.2 },
    economy: { nations: economyNations, year: era.year },
    technology: { nations: techNations, year: era.year },
  };
}

const seed = 1003, horizon = 20;
resetUniverseCounter();
const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
const sectors: Sector[] = [
  createGeopoliticsSector(), createClimateSector(), createEconomySector(), createTechnologySector(),
  deersRockAdapter({ ...SENTINEL }, seed),
];
let world = createWorld(sectors, buildSectorConfigs(era), { seed });
for (let t = 1; t <= horizon; t++) world = tick(world);
const snap = snapshot(world);

for (const s of snap.sectors) {
  const st: any = s.state;
  console.log(`\n=== SECTOR ${s.id} ===`);
  console.log("top keys:", Object.keys(st).join(", "));
  if (s.id.startsWith("deers-rock")) {
    console.log("sentinelOutput:", JSON.stringify(st.sentinelOutput));
    console.log("has .world:", !!st.world);
    if (st.world) {
      console.log("world keys:", Object.keys(st.world).join(", "));
      console.log("world.state keys:", st.world.state ? Object.keys(st.world.state).join(", ") : "(none)");
      if (st.world.state) {
        const ws = st.world.state;
        for (const k of Object.keys(ws)) {
          const v = ws[k];
          if (Array.isArray(v)) console.log(`  state.${k}: array len ${v.length}`);
          else if (v && typeof v === "object") console.log(`  state.${k}: object keys ${Object.keys(v).slice(0,8).join(",")}`);
          else console.log(`  state.${k}: ${v}`);
        }
      }
    }
    // scan all numeric leaf paths for occupancy/supply/mortality-ish values
    const flat: string[] = [];
    (function walk(o: any, p: string) {
      if (o && typeof o === "object") {
        for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k);
      } else if (typeof o === "number" && p.length < 80) flat.push(`${p}=${o}`);
    })(st, "");
    console.log("numeric leaves (first 40):");
    console.log(flat.slice(0, 40).map((x) => "  " + x).join("\n"));
  }
}
