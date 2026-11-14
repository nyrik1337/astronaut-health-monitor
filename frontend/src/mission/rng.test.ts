// Random number generator: repeatability, range and distribution shape.
import { describe, expect, it } from 'vitest';
import { mulberry32, normal } from './rng';

describe('mulberry32', () => {
  it('same seed gives the same sequence', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('different seeds give different sequences', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('stays in [0, 1) over many draws', () => {
    const r = mulberry32(99);
    for (let i = 0; i < 5000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('normal', () => {
  it('has mean near 0 and deviation near 1', () => {
    const r = mulberry32(5);
    const xs = Array.from({ length: 20000 }, () => normal(r));
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(Math.abs(Math.sqrt(variance) - 1)).toBeLessThan(0.03);
  });

  it('survives a generator that returns exactly 0', () => {
    expect(Number.isFinite(normal(() => 0))).toBe(true);
  });
});
