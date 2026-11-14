// Safety rules: no look-ahead, baseline period, deterministic replay, empty and missing data.
import { describe, expect, it } from 'vitest';
import { analyzeSeries, baselineOf } from './detect';
import { findCandidates } from './detections';
import { envZScores } from './crewVsEnv';
import { inRange } from './closedLoop';
import { runMission } from './mission';
import { snapshotAt } from './snapshot';
import { createWorkerCore } from './workerCore';
import { BASELINE_DAYS, CREW_IDS, DEMO_SEED, DOMAIN_IDS, EWMA_LAMBDA, MISSION_DAYS } from './types';
import type { WorkerRequest } from './types';

const mission = runMission(DEMO_SEED);
const CUT_DAYS = [31, 64, 124, 210, 301, 376, 450];
const series = CREW_IDS.flatMap((crew) => DOMAIN_IDS.map((domain) => ({ crew, domain })));

describe('no look-ahead', () => {
  it('analysis of days before D is identical whatever happens from day D on', () => {
    for (const { crew, domain } of series) {
      const values = mission.generated.values[crew][domain];
      const full = analyzeSeries(values);
      for (const cut of CUT_DAYS) {
        const altered = values.map((v, i) => (i >= cut - 1 ? v * 1000 + 7 : v));
        const other = analyzeSeries(altered);
        const before = cut - 1;
        expect(other.z.slice(0, before)).toEqual(full.z.slice(0, before));
        expect(other.ewma.slice(0, before)).toEqual(full.ewma.slice(0, before));
        expect(other.cusumHi.slice(0, before)).toEqual(full.cusumHi.slice(0, before));
        expect(other.cusumLo.slice(0, before)).toEqual(full.cusumLo.slice(0, before));
        expect(other.score.slice(0, before)).toEqual(full.score.slice(0, before));
      }
    }
  });

  it('detections up to day D are the same when the data stops at day D', () => {
    for (const { crew, domain } of series) {
      const values = mission.generated.values[crew][domain];
      const full = findCandidates(crew, domain, analyzeSeries(values));
      for (const cut of CUT_DAYS) {
        const truncated = findCandidates(crew, domain, analyzeSeries(values.slice(0, cut)));
        expect(truncated.filter((c) => c.day <= cut)).toEqual(full.filter((c) => c.day <= cut));
      }
    }
  });

  it('the baseline uses days 1-30 only and those days are never evaluated', () => {
    for (const { crew, domain } of series) {
      const values = mission.generated.values[crew][domain];
      const later = values.map((v, i) => (i >= BASELINE_DAYS ? v + 99 : v));
      expect(baselineOf(later)).toEqual(baselineOf(values));
      const a = mission.analysis[crew][domain];
      for (const arr of [a.z, a.ewma, a.cusumHi, a.cusumLo, a.score]) {
        expect(arr.slice(0, BASELINE_DAYS).every((v) => v === null)).toBe(true);
      }
    }
    const env = envZScores(mission.generated.env);
    expect(env.co2.slice(0, BASELINE_DAYS).every((v) => v === null)).toBe(true);
    for (let day = 1; day <= BASELINE_DAYS; day++) {
      expect(mission.grid[day - 1]?.flat().every((s) => s === 'baseline_building')).toBe(true);
    }
    expect(mission.detections.every((d) => d.day > BASELINE_DAYS)).toBe(true);
    expect(mission.alerts.every((a) => a.detectedDay > BASELINE_DAYS)).toBe(true);
  });

  it('a snapshot never reveals a later show, close or review flag', () => {
    for (let day = 1; day <= MISSION_DAYS; day++) {
      const s = snapshotAt(mission, day);
      for (const a of s.alerts) {
        expect(a.day).toBeLessThanOrEqual(day);
        if (a.outcome === 'flagged_for_review') expect(a.reviewFlaggedDay).toBeLessThanOrEqual(day);
        if (a.outcome === 'returned_to_range' || a.outcome === 'ended') {
          expect(a.closedDay).toBeLessThanOrEqual(day);
        }
        if (a.outcome === 'open') expect(a.followUpText).toBeNull();
      }
      expect(s.queue.every((q) => q.detectedDay <= day && q.day > day)).toBe(true);
    }
  });
});

describe('deterministic replay', () => {
  it('two runs with the same seed give identical snapshots on every sampled day', () => {
    const again = runMission(DEMO_SEED);
    for (const day of [1, 30, 31, 67, 124, 300, 382, 500]) {
      expect(JSON.stringify(snapshotAt(again, day))).toBe(JSON.stringify(snapshotAt(mission, day)));
    }
  });

  it('two cores answer the same request sequence identically', () => {
    const requests: WorkerRequest[] = [
      { type: 'init', seed: DEMO_SEED },
      { type: 'snapshot', day: 120 },
      { type: 'series', crew: 'B', domain: 'sleep' },
      { type: 'snapshot', day: 500 },
    ];
    const a = createWorkerCore(() => 0);
    const b = createWorkerCore(() => 0);
    for (const request of requests) expect(a.handle(request)).toEqual(b.handle(request));
  });
});

describe('empty and missing data', () => {
  it('handles an empty series', () => {
    const a = analyzeSeries([]);
    expect(a.baseline).toBeNull();
    expect([a.z, a.ewma, a.cusumHi, a.cusumLo, a.score].every((arr) => arr.length === 0)).toBe(true);
    expect(findCandidates('A', 'sleep', a)).toEqual([]);
  });

  it('needs at least 5 valid baseline values, otherwise nothing is evaluated', () => {
    const allMissing = analyzeSeries(Array.from({ length: 60 }, () => null));
    expect(allMissing.baseline).toBeNull();
    expect(allMissing.score.every((s) => s === null)).toBe(true);
    const sparse = [7, 7.1, 6.9, 7, ...Array.from({ length: 26 }, () => null), 1, 1, 1, 1, 1];
    const a = analyzeSeries(sparse);
    expect(a.baseline).toBeNull();
    expect(a.score.every((s) => s === null)).toBe(true);
    expect(findCandidates('A', 'sleep', a)).toEqual([]);
  });

  it('skips missing values without inventing them and keeps the running state', () => {
    const flat = Array.from({ length: 60 }, (_, i) => 60 + ((i * 7) % 5) - 2);
    const gappy: (number | null)[] = flat.map((v, i) => (i === 49 ? null : i === 52 ? Number.NaN : v));
    const a = analyzeSeries(gappy);
    expect(a.baseline?.samples).toBe(30);
    for (const idx of [49, 52]) {
      expect(a.z[idx]).toBeNull();
      expect(a.ewma[idx]).toBeNull();
      expect(a.cusumHi[idx]).toBeNull();
      expect(a.score[idx]).toBeNull();
    }
    const expected = EWMA_LAMBDA * (a.z[50] ?? 0) + (1 - EWMA_LAMBDA) * (a.ewma[48] ?? 0);
    expect(a.ewma[50]).toBeCloseTo(expected, 12);
  });

  it('ignores missing values inside the baseline period', () => {
    const values = Array.from({ length: 40 }, (_, i) => (i % 3 === 0 ? null : 10 + (i % 2)));
    expect(baselineOf(values)?.samples).toBe(20);
  });

  it('cannot confirm a return to range from missing values', () => {
    expect(inRange([null, null, null], 3)).toBe(false);
    expect(inRange([0.1, null, -0.2], 3)).toBe(true);
  });
});
