// Detectors: median, MAD-z, EWMA and CUSUM against hand calculations.
import { describe, expect, it } from 'vitest';
import { analyzeSeries, baselineOf, cusum, ewma, mad, median, robustZ } from './detect';
import { finiteValues } from './guards';
import type { Baseline } from './types';

// Ten numbers; sorted: 10 10 11 11 11 12 12 12 13 14.
const TEN = [10, 12, 11, 13, 12, 10, 11, 12, 14, 11];

function mustBaseline(values: readonly (number | null)[]): Baseline {
  const baseline = baselineOf(values);
  if (baseline === null) throw new Error('expected a baseline');
  return baseline;
}

describe('median and mad', () => {
  it('median of even and odd length; an empty list throws', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(() => median([])).toThrow(RangeError);
  });

  it('does not mutate its input', () => {
    const src = [3, 1, 2];
    median(src);
    expect(src).toEqual([3, 1, 2]);
  });

  it('mad of TEN is 0.5', () => {
    // median = (11 + 12) / 2 = 11.5; |x − 11.5| sorted:
    // 0.5 ×6, 1.5 ×3, 2.5 → median = (0.5 + 0.5) / 2 = 0.5
    expect(mad(TEN)).toBe(0.5);
  });
});

describe('baselineOf and robustZ', () => {
  it('matches the hand calculation on TEN', () => {
    // sigma = 0.5 × 1.4826 = 0.7413; range = 11.5 ± 1.4826
    const b = mustBaseline(TEN);
    expect(b.median).toBe(11.5);
    expect(b.sigma).toBeCloseTo(0.7413, 6);
    expect(b.lo).toBeCloseTo(10.0174, 6);
    expect(b.hi).toBeCloseTo(12.9826, 6);
    expect(b.samples).toBe(10);
    // z = (x − 11.5) / 0.7413: 10 → −2.02347, 12 → 0.67449, 14 → 3.37245
    const z = robustZ(TEN, b);
    expect(z[0]).toBeCloseTo(-2.02347, 4);
    expect(z[1]).toBeCloseTo(0.67449, 4);
    expect(z[8]).toBeCloseTo(3.37245, 4);
  });

  it('uses only the first 30 values for the baseline', () => {
    const values = [...Array.from({ length: 30 }, (_, i) => 10 + (i % 2)), 1000, 1000];
    expect(mustBaseline(values).median).toBe(10.5);
  });

  it('guards sigma = 0 on a constant series', () => {
    const b = mustBaseline([5, 5, 5, 5, 5, 5]);
    expect(b.sigma).toBeGreaterThan(0);
    expect(finiteValues(robustZ([5, 6], b))).toHaveLength(2);
  });

  it('guards sigma on a constant zero series', () => {
    expect(mustBaseline([0, 0, 0, 0, 0]).sigma).toBeGreaterThan(0);
  });
});

describe('ewma', () => {
  it('matches the hand calculation (recursion starts from 0)', () => {
    // e0 = 0.2·1 = 0.2; e1 = 0.2·2 + 0.8·0.2 = 0.56;
    // e2 = 0 + 0.8·0.56 = 0.448; e3 = −0.2 + 0.8·0.448 = 0.1584
    const e = ewma([1, 2, 0, -1], 0.2);
    expect(e[0]).toBeCloseTo(0.2, 10);
    expect(e[1]).toBeCloseTo(0.56, 10);
    expect(e[2]).toBeCloseTo(0.448, 10);
    expect(e[3]).toBeCloseTo(0.1584, 10);
  });
});

describe('cusum', () => {
  it('matches the hand calculation for both sides', () => {
    // hi: 0, 1.0, 2.5, 2.1, 0.1, 0   (S = max(0, S + z − 0.5))
    // lo: 0, 0, 0, 0, 1.0, 2.5      (S = max(0, S − z − 0.5))
    const c = cusum([0.2, 1.5, 2.0, 0.1, -1.5, -2.0], 0.5);
    const round = (vs: (number | null)[]): (number | null)[] =>
      vs.map((v) => (v === null ? null : Math.round(v * 100) / 100));
    expect(round(c.hi)).toEqual([0, 1, 2.5, 2.1, 0.1, 0]);
    expect(round(c.lo)).toEqual([0, 0, 0, 0, 1, 2.5]);
  });
});

describe('analyzeSeries', () => {
  const flat = Array.from({ length: 60 }, (_, i) => 60 + ((i * 7) % 5) - 2);
  const maxScore = (scores: readonly (number | null)[]): number =>
    Math.max(...finiteValues(scores));

  it('keeps the score below "sustained" on a stationary series', () => {
    const a = analyzeSeries(flat);
    expect(a.score.length).toBe(60);
    expect(maxScore(a.score)).toBeLessThan(2);
  });

  it('a single huge spike never trips CUSUM on its own (winsorized)', () => {
    const spiked = flat.map((v, i) => (i === 45 ? v + 500 : v));
    const a = analyzeSeries(spiked);
    expect(a.z[45]).toBeGreaterThan(50);
    expect(Math.max(...finiteValues(a.cusumHi))).toBeLessThan(5);
    expect(a.score[45]).toBe(1);
  });

  it('a sustained shift is scored sustained or higher', () => {
    const shifted = flat.map((v, i) => (i >= 40 ? v - 4 : v));
    const a = analyzeSeries(shifted);
    expect(maxScore(a.score)).toBeGreaterThanOrEqual(2);
  });
});
