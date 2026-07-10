import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { request } from "node:http";
import { start, stop } from "./server.js";

function req(path: string, method = "GET", body?: Record<string, unknown>): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const opts = { hostname: "localhost", port: 3099, path, method, headers: { "Content-Type": "application/json" } as Record<string, string> };
    const r = method === "POST" && body ? (() => {
      const b = JSON.stringify(body);
      opts.headers["Content-Length"] = Buffer.byteLength(b).toString();
      const req = request(opts, (res) => { let d = ""; res.on("data", (c: Buffer) => d += c.toString()); res.on("end", () => { try { resolve({ status: res.statusCode ?? 500, data: JSON.parse(d) }); } catch { resolve({ status: res.statusCode ?? 500, data: d }); } }); });
      req.write(b); req.end();
    })() : request(opts, (res) => { let d = ""; res.on("data", (c: Buffer) => d += c.toString()); res.on("end", () => { try { resolve({ status: res.statusCode ?? 500, data: JSON.parse(d) }); } catch { resolve({ status: res.statusCode ?? 500, data: d }); } }); }).end();
  });
}

describe("API Server", () => {
  beforeAll(async () => { await start(3099); }, 10000);
  afterAll(async () => { await stop(); }, 5000);

  it("GET /api/status", async () => {
    const { status, data } = await req("/api/status");
    expect(status).toBe(200);
    expect(data).toHaveProperty("ok", true);
    expect(data).toHaveProperty("version", "0.1.0");
  });

  it("GET /api/eras", async () => {
    const { status, data } = await req("/api/eras");
    expect(status).toBe(200);
    expect(data).toHaveProperty("eras");
    const r = data as { eras: Array<{ era: string }> };
    expect(r.eras.length).toBeGreaterThan(0);
  });

  it("GET /api/sectors", async () => {
    const { status, data } = await req("/api/sectors");
    expect(status).toBe(200);
    const r = data as { sectors: Array<{ id: string; cadence: number }> };
    expect(r.sectors.find((s) => s.id === "economy")?.cadence).toBe(3);
  });

  it("GET /api/experiments empty", async () => {
    const { status, data } = await req("/api/experiments");
    expect(status).toBe(200);
    expect((data as { experiments: unknown[] }).experiments).toHaveLength(0);
  });

  it("POST /api/experiments 400 without rewindPointId", async () => {
    const { status } = await req("/api/experiments", "POST", {});
    expect(status).toBe(400);
  });

  it("POST /api/experiments 400 bad rewindPointId", async () => {
    const { status } = await req("/api/experiments", "POST", { rewindPointId: "GHOST" });
    expect(status).toBe(400);
  });

  it("POST /api/experiments queues an experiment", async () => {
    const { status, data } = await req("/api/experiments", "POST", { rewindPointId: "RP-CONTEMP-003", ticks: 5, numSeeds: 2 });
    expect(status).toBe(202);
    const r = data as { experimentId: string };
    expect(r.experimentId).toBeDefined();

    const getRes = await req(`/api/experiments/${r.experimentId}`);
    expect(getRes.status).toBe(200);
  }, 30000);
});
