# Somnium Engine

> *Codename for the Kronos Engine — one engine, infinite timelines.*

A deterministic, multi-scale counterfactual simulation engine. Plug in any world — Earth, Middle-earth, Agatha Christie's universe — and ask "what if?"

## Quick start

```bash
npm install
npm run build
npm test           # 307 tests
npm run check      # tsc --noEmit
```

## Architecture

```
World Engine (1 tick = 1 day)
  ↓ MacroConditionPacket
Adapter Layer (translation)
  ↓ admissionMultiplier, diagnosis weights
Deers Rock (1 tick = 1 minute)
  ↑ HospitalSentinelOutput
Adapter Layer (aggregation)
  ↑ occupancy, mortality, disease prevalence
World Engine
```

One engine, infinite timelines.
Every seed is a history — every snapshot is a choice.

## Reproduction

One command reproduces every deterministic result — type-check, full test suite, fact-verification gate, P-003 calibrated experiment, and sensitivity sweep:

```bash
npx tsx scripts/reproduce.ts
```

See `docs/REPRODUCIBILITY.md` for prerequisites, manual step-by-step reproduction of P-003 / P-004 / the sensitivity sweep, expected numbers, and the determinism statement.

## Project overview

Full details at `docs/PROJECT-OVERVIEW.md`.
