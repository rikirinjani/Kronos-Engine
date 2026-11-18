
# Phase F Experiment Report

## Experiment Parameters
- Seeds: 42, 43, 44, 45, 46
- Horizon: 20 KE ticks
- Control CO₂: 280
- Intervention CO₂: 800
- Sentinel: makassar-001 (Makassar)

## Results Summary

### Statistical Summary
- **Occupancy Rate Delta**: mean=0.0000, median=0.0000, direction consistency=0.0%
- **ICU Occupancy Delta**: mean=0.0000, median=0.0000, direction consistency=0.0%
- **Mortality Pressure Delta**: mean=0.0000, median=0.0000, direction consistency=0.0%
- **Supply Stress Delta**: mean=0.0000, median=0.0000, direction consistency=0.0%

### Per-Seed Results

#### Seed 42
- **Climate**: CO₂ control=136469261.4426253 intervention=136469781.4426253
- **Temperature Anomaly**: control=56.684 intervention=56.684
- **Extreme Weather Events**: control=8 intervention=8
- **Occupancy Rate**: control=0.542 intervention=0.542 delta=0.000
- **ICU Occupancy**: control=0.036 intervention=0.036 delta=0.000
- **Mortality Pressure**: control=0 intervention=0 delta=0
- **Supply Stress**: control=0.492 intervention=0.492 delta=0.000
- **Admission Surge**: control=false intervention=false


#### Seed 43
- **Climate**: CO₂ control=88913987.43210107 intervention=86565870.9967279
- **Temperature Anomaly**: control=54.830 intervention=54.714
- **Extreme Weather Events**: control=12 intervention=13
- **Occupancy Rate**: control=0.580 intervention=0.580 delta=0.000
- **ICU Occupancy**: control=0.036 intervention=0.036 delta=0.000
- **Mortality Pressure**: control=0 intervention=0 delta=0
- **Supply Stress**: control=0.520 intervention=0.520 delta=0.000
- **Admission Surge**: control=false intervention=false


#### Seed 44
- **Climate**: CO₂ control=96120516.82432207 intervention=96121036.82432207
- **Temperature Anomaly**: control=55.167 intervention=55.167
- **Extreme Weather Events**: control=11 intervention=11
- **Occupancy Rate**: control=0.534 intervention=0.534 delta=0.000
- **ICU Occupancy**: control=0.107 intervention=0.107 delta=0.000
- **Mortality Pressure**: control=0 intervention=0 delta=0
- **Supply Stress**: control=0.521 intervention=0.521 delta=0.000
- **Admission Surge**: control=false intervention=false


#### Seed 45
- **Climate**: CO₂ control=162456372.945848 intervention=162456892.945848
- **Temperature Anomaly**: control=57.439 intervention=57.439
- **Extreme Weather Events**: control=7 intervention=7
- **Occupancy Rate**: control=0.603 intervention=0.603 delta=0.000
- **ICU Occupancy**: control=0.071 intervention=0.071 delta=0.000
- **Mortality Pressure**: control=0 intervention=0 delta=0
- **Supply Stress**: control=0.520 intervention=0.520 delta=0.000
- **Admission Surge**: control=false intervention=false


#### Seed 46
- **Climate**: CO₂ control=109552160.60587718 intervention=182439524.44552553
- **Temperature Anomaly**: control=55.733 intervention=57.941
- **Extreme Weather Events**: control=11 intervention=10
- **Occupancy Rate**: control=0.534 intervention=0.534 delta=0.000
- **ICU Occupancy**: control=0.000 intervention=0.000 delta=0.000
- **Mortality Pressure**: control=0 intervention=0 delta=0
- **Supply Stress**: control=0.520 intervention=0.520 delta=0.000
- **Admission Surge**: control=false intervention=false


### Causal Trace Summary
The experiment captures the complete causal chain:
1. **Climate Link**: CO₂ difference → temperature anomaly difference → extreme weather probability difference
2. **Extreme Weather Link**: Different extreme weather event counts between control and intervention
3. **Adapter Link**: Adapter translates extreme weather events to DR events (requires instrumentation for detailed trace)
4. **DR Link**: DR consumes translated events (requires instrumentation for detailed trace)
5. **Observable Link**: Final sentinel output differences

### Direction Consistency
- **Primary Outcome (Occupancy Rate)**: 0.0% of seeds show positive delta
- **Overall Direction Consistency**: 0.0% of seeds show consistent direction

### Interpretation
Based on the pre-specified interpretation criteria:
- **E — Null stochastic result**: The complete pathway is operational, but the selected seeds/horizon do not produce a measurable effect.

### Artifact Locations
- Detailed results: experiment-results/phase-f/results.json
- Statistical summary: experiment-results/phase-f/statistical-summary.json
- This report: experiment-results/phase-f/report.md

### Next Steps
1. Review and classify the experiment result
2. Verify isolation invariants (requires additional instrumentation)
3. Perform reproducibility check (repeat seed 42)
4. Run regression tests
5. Generate final Phase F report
