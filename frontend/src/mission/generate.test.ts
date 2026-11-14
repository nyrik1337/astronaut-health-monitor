// Generator: data shape, repeatability, ranges and scripted scenario signal.
import { describe, expect, it } from 'vitest';
import { generateMission } from './generate';
import { median } from './detect';
import {
  CREW_IDS,
  DEMO_SEED,
  DOMAIN_IDS,
  ILLUSTRATIVE_EVENT_DOSE_REFERENCE_MSV,
  MISSION_DAYS,
} from './types';

const gen = generateMission(DEMO_SEED);
const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
const valueAt = (xs: readonly number[], i: number): number => {
  const v = xs[i];
  if (v === undefined) throw new Error(`no value at ${i}`);
  return v;
};

describe('generateMission', () => {
  it('produces 4 crew x 6 domains x 500 days, marked synthetic', () => {
    expect(gen.synthetic).toBe(true);
    for (const crew of CREW_IDS) {
      for (const domain of DOMAIN_IDS) expect(gen.values[crew][domain]).toHaveLength(MISSION_DAYS);
    }
    expect(gen.env.co2).toHaveLength(MISSION_DAYS);
    expect(gen.env.noise).toHaveLength(MISSION_DAYS);
  });

  it('same seed gives deep-equal data, different seed differs', () => {
    expect(generateMission(DEMO_SEED)).toEqual(gen);
    expect(generateMission(DEMO_SEED + 1).values.A.cardio).not.toEqual(gen.values.A.cardio);
  });

  it('lists the five scenario markers in order', () => {
    expect(gen.events.map((e) => e.markerDay)).toEqual([40, 120, 210, 300, 380]);
    expect(gen.events.map((e) => e.id)).toEqual([
      'sleep-drift-b',
      'module-co2',
      'hr-artifact',
      'solar-storm',
      'return-to-range-c',
    ]);
  });

  it('draws personal levels in the stated ranges', () => {
    for (const crew of CREW_IDS) {
      const hr = median(gen.values[crew].cardio.slice(0, 30));
      const sleep = median(gen.values[crew].sleep.slice(0, 30));
      expect(hr).toBeGreaterThan(50);
      expect(hr).toBeLessThan(66);
      expect(sleep).toBeGreaterThan(6.3);
      expect(sleep).toBeLessThan(7.9);
    }
  });

  it('keeps every value finite and radiation positive', () => {
    for (const crew of CREW_IDS) {
      for (const domain of DOMAIN_IDS) {
        expect(gen.values[crew][domain].every(Number.isFinite)).toBe(true);
      }
      expect(Math.min(...gen.values[crew].radiation)).toBeGreaterThan(0);
    }
  });

  it('crew B sleep is lower at the bottom of the drift than at the start', () => {
    const early = mean(gen.values.B.sleep.slice(0, 30));
    const bottom = mean(gen.values.B.sleep.slice(76, 80));
    expect(bottom).toBeLessThan(early - 0.4);
  });

  it('CO2 rises over days 120-128 only', () => {
    expect(mean(gen.env.co2.slice(119, 128))).toBeGreaterThan(mean(gen.env.co2.slice(0, 30)) + 0.5);
    expect(mean(gen.env.co2.slice(200, 260))).toBeLessThan(3.1);
  });

  it('single-day heart-rate spike for A only on day 210', () => {
    const hr = gen.values.A.cardio;
    expect(valueAt(hr, 209)).toBeGreaterThan(valueAt(hr, 208) + 5);
    expect(valueAt(gen.values.B.cardio, 209)).toBeLessThan(80);
  });

  it('particle-event dose is large for every member and below the illustrative reference', () => {
    let total = 0;
    for (const crew of CREW_IDS) {
      const dose = gen.values[crew].radiation;
      expect(valueAt(dose, 299)).toBeGreaterThan(20);
      total += valueAt(dose, 299) + valueAt(dose, 300) + valueAt(dose, 301);
    }
    expect(total / 4).toBeLessThan(ILLUSTRATIVE_EVENT_DOSE_REFERENCE_MSV);
    expect(total / 4).toBeGreaterThan(50);
  });
});
