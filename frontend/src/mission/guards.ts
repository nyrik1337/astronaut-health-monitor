/**
 * SYNTHETIC MISSION SIMULATION — index guards.
 *
 * Replaces non-null assertions (`items[i]!`). An out-of-range read is a programming error, so it
 * throws instead of silently substituting a value; results stay deterministic.
 */

export function at<T>(items: readonly T[], index: number): T {
  const value = items[index];
  if (value === undefined) {
    throw new RangeError(`Index ${index} is outside an array of length ${items.length}.`);
  }
  return value;
}

/** A requested day as a whole day within 1..lastDay; non-numbers become day 1. */
export function clampDay(day: number, lastDay: number): number {
  return Number.isFinite(day) ? Math.max(1, Math.min(lastDay, Math.round(day))) : 1;
}

/** Finite numbers only; null, undefined and NaN are treated as missing. */
export function finiteValues(values: readonly (number | null | undefined)[]): number[] {
  return values.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  );
}
