/**
 * R-2: sentinelOutput aliasing diagnostic
 *
 * Investigates whether sentinelOutput stored by reference in makeSnapshot (line 218)
 * and doReconstruct (line 253) creates aliasing risk — where mutation of a live
 * sentinelOutput contaminates a previously captured rewind point.
 *
 * FINDING: sentinelOutput IS aliased (mutation propagates), but safe in practice.
 *
 * Root cause analysis:
 *
 * 1. extractSentinelOutput() (line 128-151) creates a NEW object literal each call.
 *    diseasePrevalence is built via Object.fromEntries(sorted), which also creates
 *    a new object each time. Each tick produces a fresh sentinelOutput.
 *
 * 2. Each tick (line 327) calls extractSentinelOutput(), producing a fresh object.
 *    Line 372 stores this fresh object in the new state, replacing self.sentinelOutput.
 *    The old reference in any prior snapshot is never mutated by normal operation.
 *
 * 3. doReconstruct (line 253) assigns snapshot.sentinelOutput by reference to the
 *    reconstructed state. The reconstructed state and snapshot share the same object.
 *    However, the reconstructed state's next tick creates a new sentinelOutput
 *    (line 372), replacing the reference. The snapshot's sentinelOutput is never
 *    mutated by the reconstructed state during normal operation.
 *
 * 4. deepClone is applied to hospitalState (line 242) and events (line 215) because
 *    those objects ARE mutated in-place by Deers-Rock's internal handlers (e.g.,
 *    cssdHandler mutates CSSD trays). sentinelOutput is NOT mutated in-place by
 *    any Deers-Rock handler — it is always replaced wholesale via extractSentinelOutput.
 *
 * 5. ALIASING CONFIRMED: The diagnostic test (test 3 in deers-rock-sentinel-alias.test.ts)
 *    shows that mutating sentinelOutput.diseasePrevalence AFTER snapshot capture DOES
 *    propagate to the snapshot. Both reference the same object. This is real aliasing.
 *
 * DIAGNOSIS: SentinelOutput reference capture (line 218) and assignment (line 253)
 * create real aliasing, but it is safe in practice because:
 *   a) No production code mutates sentinelOutput in-place
 *   b) Each tick replaces the reference with a fresh object
 *   c) The aliasing is one-directional (snapshot → reconstructed state, not reverse)
 *
 * RECOMMENDATION: Apply deepClone to sentinelOutput in makeSnapshot (line 218) and
 * doReconstruct (line 253) for defense-in-depth. Cost is negligible; failure mode
 * is silent contamination if any future code mutates sentinelOutput.
 *
 * VERIFICATION: 5/5 tests pass in deers-rock-sentinel-alias.test.ts.
 */

export {};
