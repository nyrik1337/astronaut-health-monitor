/**
 * SYNTHETIC MISSION SIMULATION — deterministic random numbers.
 *
 * The same seed always produces the same mission, so the demonstration can be replayed exactly.
 */

/** mulberry32: uniform numbers in [0, 1). State lives in the closure. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal value (Box–Muller; uses two draws). */
export function normal(rand: () => number): number {
  const u1 = 1 - rand(); // (0, 1], so log never receives 0
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
