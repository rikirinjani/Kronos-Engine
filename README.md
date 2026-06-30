# Somnium Engine

> *Codename for the Kronos Engine — one engine, infinite timelines.*

A deterministic, multi-scale counterfactual simulation engine. Plug in any world — Earth, Middle-earth, Agatha Christie's universe — and ask "what if?"

## Quick start

```bash
npm install
npm run build
npm test           # 197+ tests
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

## Project overview

Full details at `docs/PROJECT-OVERVIEW.md`.
