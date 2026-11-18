#!/usr/bin/env python3
"""EXP-001 orchestrator.

Runs the counterfactual stability experiment across a set of horizons, then the
analyzer, and writes provenance/config/manifest/resource metadata.

Usage:
    python scripts/exp-001-orchestrate.py --horizons=10,20,50 --n=1000 --seed-start=1000
    python scripts/exp-001-orchestrate.py --horizons=10,20,50 --n=10000 --seed-start=2000

Both the experiment and the analyzer are invoked compiled from `dist/` (the CLI
guards are extension-agnostic). Run `npm run build` before invoking this script.
"""

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

EXPERIMENT_ID = "EXP-001"
HOURLY_RATE_USD = 0.03
REPO_ROOT = Path(__file__).resolve().parent.parent

# Both invoked compiled from dist/ (guards are extension-agnostic).
EXP_CMD = ["node", "dist/experiment/experiments/exp-001-stability.js"]
ANALYZE_CMD = ["node", "dist/experiment/experiments/exp-001-analyze.js"]


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def git(args: list[str], cwd: Path) -> str | None:
    try:
        return subprocess.check_output(["git", *args], cwd=cwd, text=True).strip()
    except Exception:
        return None


def get_cpu_model() -> str | None:
    try:
        with open("/proc/cpuinfo", "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("model name"):
                    return line.split(":", 1)[1].strip()
    except OSError:
        pass
    return platform.processor() or None


def get_total_ram_mb() -> int | None:
    try:
        with open("/proc/meminfo", "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("MemTotal"):
                    return int(line.split()[1]) // 1024
    except OSError:
        pass
    try:
        import psutil  # type: ignore

        return psutil.virtual_memory().total // (1024 * 1024)
    except Exception:
        return None


def parse_time_v(stderr: str) -> float | None:
    """Parse 'Maximum resident set size (kbytes)' from /usr/bin/time -v output -> MB."""
    for line in stderr.splitlines():
        if "Maximum resident set size" in line:
            try:
                return int(line.split(":", 1)[1].strip().split()[0]) / 1024.0
            except Exception:
                return None
    return None


def run_and_measure(cmd: list[str], cwd: Path) -> tuple[float, float | None, int]:
    """Run cmd; return (wall_sec, peak_rss_mb, returncode).

    Peak RSS priority: /usr/bin/time -v -> psutil polling -> None (wall only).
    """
    # Resolve the executable (Windows .cmd shims like npx.cmd need the full path).
    resolved = cmd
    exe = shutil.which(cmd[0])
    if exe:
        resolved = [exe, *cmd[1:]]

    t0 = time.monotonic()
    time_bin = "/usr/bin/time"
    if os.path.exists(time_bin):
        try:
            proc = subprocess.run([time_bin, "-v", *resolved], cwd=cwd, capture_output=True, text=True)
            wall = time.monotonic() - t0
            return wall, parse_time_v(proc.stderr), proc.returncode
        except Exception:
            pass
    try:
        import psutil  # type: ignore

        proc = subprocess.Popen(resolved, cwd=cwd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        p = psutil.Process(proc.pid)
        peak = 0
        while proc.poll() is None:
            try:
                rss = p.memory_info().rss
                if rss > peak:
                    peak = rss
            except Exception:
                pass
            time.sleep(0.05)
        proc.wait()
        wall = time.monotonic() - t0
        return wall, (peak / (1024 * 1024)) if peak else None, proc.returncode
    except Exception:
        pass
    try:
        proc = subprocess.run(resolved, cwd=cwd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        wall = time.monotonic() - t0
        return wall, None, proc.returncode
    except Exception as e:
        raise RuntimeError(f"failed to spawn {cmd[0]}: {e}") from e


def count_lines(path: Path) -> int:
    n = 0
    with open(path, "r", encoding="utf-8") as f:
        for _ in f:
            n += 1
    return n


def sum_runtime_ms(path: Path) -> float:
    """Sum the experiment's own per-run runtimeMs (single-threaded CPU time)."""
    total = 0.0
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                total += float(json.loads(line).get("runtimeMs", 0.0))
            except Exception:
                continue
    return total


def read_first_intervention(path: Path) -> dict | None:
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                return json.loads(line).get("intervention")
            except Exception:
                return None
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="EXP-001 orchestrator")
    parser.add_argument("--horizons", default="10,20,50", help="comma-separated horizons")
    parser.add_argument("--n", type=int, default=1000, help="seeds per horizon")
    parser.add_argument("--seed-start", type=int, default=1000, help="first seed")
    parser.add_argument(
        "--out-dir",
        default="experiment-results/mc-lab",
        help="output directory (relative to repo root, or absolute)",
    )
    args = parser.parse_args()

    # Line-buffer stdout so progress lines interleave correctly with subprocess output.
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except Exception:
        pass

    horizons = [int(h) for h in args.horizons.split(",") if h.strip()]
    if not horizons:
        print("[EXP-001] no horizons given", file=sys.stderr)
        return 1

    out_dir = Path(args.out_dir)
    if not out_dir.is_absolute():
        out_dir = REPO_ROOT / out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    started_at = iso_now()
    provenance = {
        "gitCommit": git(["rev-parse", "HEAD"], REPO_ROOT),
        "gitBranch": git(["rev-parse", "--abbrev-ref", "HEAD"], REPO_ROOT),
        "nodeVersion": subprocess.check_output(["node", "--version"], text=True).strip(),
        "hostname": platform.node(),
        "platform": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "cpuModel": get_cpu_model(),
        "totalRamMb": get_total_ram_mb(),
        "vpsSpec": f"{platform.system()} {platform.machine()}, {os.cpu_count() or '?'} cores",
        "startedAt": started_at,
        "finishedAt": None,
    }

    # Ensure the compiled analyzer exists (the experiment runs from source).
    dist_analyze = REPO_ROOT / "dist" / "experiment" / "experiments" / "exp-001-analyze.js"
    if not dist_analyze.exists():
        print("[EXP-001] dist build missing — running `npx tsc`...")
        subprocess.run(["npx", "tsc"], cwd=REPO_ROOT, check=True)

    resource_horizons: list[dict] = []
    manifest_files: list[dict] = []
    total_runs = 0
    total_wall = 0.0
    total_cpu_hours = 0.0
    total_cost = 0.0
    intervention = None

    for h in horizons:
        out_file = out_dir / f"runs-H{h}.jsonl"
        cmd = [
            *EXP_CMD,
            f"--seed-start={args.seed_start}",
            f"--seed-count={args.n}",
            f"--horizon={h}",
            f"--out={out_file}",
        ]
        print(f"[EXP-001] horizon={h} n={args.n} seed-start={args.seed_start} -> {out_file}")
        wall, peak_rss, rc = run_and_measure(cmd, REPO_ROOT)
        if rc != 0:
            print(f"[EXP-001] FAILED horizon={h} rc={rc}", file=sys.stderr)
            return 1
        lines = count_lines(out_file)
        bytes_ = out_file.stat().st_size
        cpu_hours = sum_runtime_ms(out_file) / 3.6e6
        cost = cpu_hours * HOURLY_RATE_USD
        if intervention is None:
            intervention = read_first_intervention(out_file)
        resource_horizons.append(
            {
                "horizon": h,
                "n": lines,
                "wallSec": round(wall, 3),
                "cpuHours": round(cpu_hours, 6),
                "peakRssMb": round(peak_rss, 1) if peak_rss is not None else None,
                "outputBytes": bytes_,
                "estimatedCostUsd": round(cost, 6),
            }
        )
        manifest_files.append({"name": out_file.name, "bytes": bytes_, "lines": lines})
        total_runs += lines
        total_wall += wall
        total_cpu_hours += cpu_hours
        total_cost += cost

    print("[EXP-001] running analyzer...")
    subprocess.run([*ANALYZE_CMD, f"--dir={out_dir}"], cwd=REPO_ROOT, check=True)

    finished_at = iso_now()
    provenance["finishedAt"] = finished_at

    config = {
        "experimentId": EXPERIMENT_ID,
        "seedStart": args.seed_start,
        "n": args.n,
        "horizons": horizons,
        "intervention": intervention,
        "generatedAt": started_at,
    }
    manifest = {
        "files": manifest_files,
        "totalRuns": total_runs,
        "horizons": horizons,
        "generatedAt": finished_at,
    }
    resource = {
        "horizons": resource_horizons,
        "totalWallSec": round(total_wall, 3),
        "totalCpuHours": round(total_cpu_hours, 6),
        "estimatedCostUsd": round(total_cost, 6),
        "hourlyRateAssumed": HOURLY_RATE_USD,
    }

    for name, obj in [
        ("provenance.json", provenance),
        ("config.json", config),
        ("manifest.json", manifest),
        ("resource.json", resource),
    ]:
        (out_dir / name).write_text(json.dumps(obj, indent=2) + "\n", encoding="utf-8")
        print(f"[EXP-001] wrote {out_dir / name}")

    print(
        f"[EXP-001] orchestrator complete: {total_runs} runs across horizons {horizons}, "
        f"wall={total_wall:.1f}s, cpuHours={total_cpu_hours:.3f}, cost~=${total_cost:.4f}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())