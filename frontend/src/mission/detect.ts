/**
 * SYNTHETIC MISSION SIMULATION — statistical detectors (experimental, not clinically validated).
 *
 * Personal baseline (median and MAD from days 1–30), robust z-score, EWMA and CUSUM.
 * No look-ahead: days 1–30 only build the baseline and are never evaluated; from day 31 the
 * baseline is frozen and every value is compared with it using that day's value only. EWMA and
 * CUSUM run forward in time from day 31. Missing values (null / NaN) are skipped, not invented.
 */
import { BASELINE_DAYS, CUSUM_K, EWMA_LAMBDA, MAD_SCALE, MIN_BASELINE_SAMPLES } from './types';
import type { Baseline, DetectorScore, SeriesAnalysis } from './types';
import { at, finiteValues } from './guards';
import { scoreAt } from './signals';

/** z is clipped to ±3.5 before EWMA and CUSUM, so one sensor spike cannot fill the sum alone. */
export const WINSOR_Z = 3.5;
/** Floor for sigma when MAD is zero (constant series). */
const MIN_SIGMA_REL = 0.01;
const MIN_SIGMA_ABS = 1e-6;

/** Median of a non-empty list. An empty list is a caller error, so it throws. */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError('The median of an empty list is undefined.');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? at(sorted, mid) : (at(sorted, mid - 1) + at(sorted, mid)) / 2;
}

/** Median absolute deviation from the median (unscaled). */
export function mad(values: readonly number[]): number {
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
}

/**
 * Personal baseline from the valid values of days 1–30 only; sigma = MAD × 1.4826.
 * Returns null when fewer than MIN_BASELINE_SAMPLES valid values exist.
 */
export function baselineOf(values: readonly (number | null)[]): Baseline | null {
  const head = finiteValues(values.slice(0, BASELINE_DAYS));
  if (head.length < MIN_BASELINE_SAMPLES) return null;
  const med = median(head);
  const madValue = mad(head);
  const scaled = madValue * MAD_SCALE;
  const sigma = scaled > 0 ? scaled : Math.max(Math.abs(med) * MIN_SIGMA_REL, MIN_SIGMA_ABS);
  return {
    median: med,
    mad: madValue,
    sigma,
    lo: med - 2 * sigma,
    hi: med + 2 * sigma,
    samples: head.length,
  };
}

/** Robust z for each value against a baseline; missing values stay null. */
export function robustZ(values: readonly (number | null)[], baseline: Baseline): (number | null)[] {
  return values.map((v) =>
    v === null || !Number.isFinite(v) ? null : (v - baseline.median) / baseline.sigma,
  );
}

/** Robust z from day 31 on, against the frozen days 1–30 baseline; null before day 31. */
export function evaluatedZ(values: readonly (number | null)[]): (number | null)[] {
  const baseline = baselineOf(values);
  if (baseline === null) return values.map(() => null);
  return robustZ(values, baseline).map((z, i) => (i < BASELINE_DAYS ? null : z));
}

/**
 * EWMA e_t = λ·z_t + (1 − λ)·e_{t−1} with e_{−1} = 0 (so e_0 = λ·z_0).
 * A missing z keeps the previous state and outputs null for that day.
 */
export function ewma(z: readonly (number | null)[], lambda: number): (number | null)[] {
  const out: (number | null)[] = [];
  let prev = 0;
  for (const value of z) {
    if (value === null) {
      out.push(null);
      continue;
    }
    prev = lambda * value + (1 - lambda) * prev;
    out.push(prev);
  }
  return out;
}

/** Two-sided CUSUM; both sums are non-negative, "lo" grows when values fall. */
export function cusum(
  z: readonly (number | null)[],
  k: number,
): { hi: (number | null)[]; lo: (number | null)[] } {
  const hi: (number | null)[] = [];
  const lo: (number | null)[] = [];
  let sHi = 0;
  let sLo = 0;
  for (const value of z) {
    if (value === null) {
      hi.push(null);
      lo.push(null);
      continue;
    }
    sHi = Math.max(0, sHi + value - k);
    sLo = Math.max(0, sLo - value - k);
    hi.push(sHi);
    lo.push(sLo);
  }
  return { hi, lo };
}

const clamp = (v: number, limit: number): number => Math.max(-limit, Math.min(limit, v));

export function analyzeSeries(values: readonly (number | null)[]): SeriesAnalysis {
  const baseline = baselineOf(values);
  const z = evaluatedZ(values);
  const clipped = z.map((v) => (v === null ? null : clamp(v, WINSOR_Z)));
  const smooth = ewma(clipped, EWMA_LAMBDA);
  const sums = cusum(clipped, CUSUM_K);
  const score = z.map((v, i): DetectorScore | null => {
    const e = smooth[i];
    const hi = sums.hi[i];
    const lo = sums.lo[i];
    if (v === null || e === null || e === undefined) return null;
    if (hi === null || hi === undefined || lo === null || lo === undefined) return null;
    return scoreAt(v, e, hi, lo);
  });
  return { baseline, z, ewma: smooth, cusumHi: sums.hi, cusumLo: sums.lo, score };
}
