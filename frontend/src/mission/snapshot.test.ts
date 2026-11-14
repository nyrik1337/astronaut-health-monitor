// Snapshot and the pure request/response core on seed 2026.
import { describe, expect, it } from 'vitest';
import { runMission } from './mission';
import { missionMeta, seriesView, snapshotAt } from './snapshot';
import { REVIEW_ORDER } from './signals';
import { createWorkerCore } from './workerCore';
import { DEMO_SEED, MISSION_DAYS } from './types';
import type { WorkerResponse } from './types';

const mission = runMission(DEMO_SEED);
type SnapshotResponse = Extract<WorkerResponse, { type: 'snapshot' }>;

describe('alert budget in the mission', () => {
  it('never shows more than budgetPerDay non-environmental alerts per person per day', () => {
    const counts = new Map<string, number>();
    for (const a of mission.alerts.filter((x) => x.category !== 'environmental_event')) {
      for (const c of a.affected) {
        counts.set(`${a.day}:${c}`, (counts.get(`${a.day}:${c}`) ?? 0) + 1);
      }
    }
    expect(Math.max(0, ...counts.values())).toBeLessThanOrEqual(mission.budgetPerDay);
  });
});

describe('snapshotAt', () => {
  it('has monotonic counters, small packets and a queue disjoint from alerts', () => {
    let prev = 0;
    for (let day = 1; day <= MISSION_DAYS; day++) {
      const s = snapshotAt(mission, day);
      expect(s.counters.total).toBeGreaterThanOrEqual(prev);
      prev = s.counters.total;
      expect(s.packet.sizeKB).toBeGreaterThan(0);
      expect(s.packet.sizeKB).toBeLessThan(10);
      const ids = new Set(s.alerts.map((a) => a.id));
      expect(s.queue.every((q) => !ids.has(q.id))).toBe(true);
      expect(s.alerts.every((a) => a.day <= day)).toBe(true);
      expect(s.counters.deferred).toBe(s.queue.length);
    }
  });

  it('sorts alerts newest first and packet items in review order', () => {
    const s = snapshotAt(mission, 300);
    const days = s.alerts.map((a) => a.day);
    expect(days).toEqual([...days].sort((a, b) => b - a));
    const order = s.packet.items.map((i) => REVIEW_ORDER[i.category]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(s.packet.items[0]?.category).toBe('environmental_event');
  });

  it('keeps an alert open before its close day', () => {
    const alert = mission.alerts.find((a) => a.scenarioId === 'return-to-range-c');
    expect(alert?.closedDay).not.toBeNull();
    const before = snapshotAt(mission, (alert?.closedDay ?? 0) - 1).alerts.find(
      (a) => a.id === alert?.id,
    );
    expect(before?.outcome).toBe('open');
    expect(before?.followUpText).toBeNull();
  });

  it('keeps total dose growing, counts false alarms and clamps the day', () => {
    const a = snapshotAt(mission, 10);
    const b = snapshotAt(mission, 499);
    expect(b.environment.totalDoseMSv).toBeGreaterThan(a.environment.totalDoseMSv);
    expect(b.counters.falseAlarms).toBeLessThanOrEqual(b.counters.total);
    expect(snapshotAt(mission, 9999).day).toBe(MISSION_DAYS);
    expect(snapshotAt(mission, -4).day).toBe(1);
  });

  it('builds series view and meta, both marked synthetic', () => {
    const v = seriesView(mission, 'B', 'sleep');
    expect(v.synthetic).toBe(true);
    expect(v.values).toHaveLength(MISSION_DAYS);
    expect(v.ewma).toHaveLength(MISSION_DAYS);
    const meta = missionMeta(mission, 12);
    expect(meta.synthetic).toBe(true);
    expect(meta.computeMs).toBe(12);
    expect(meta.events.map((e) => e.markerDay)).toEqual([40, 120, 210, 300, 380]);
  });
});

describe('workerCore', () => {
  it('answers with an error before init', () => {
    const core = createWorkerCore(() => 0);
    expect(core.handle({ type: 'snapshot', day: 1 }).type).toBe('error');
    expect(core.handle({ type: 'series', crew: 'A', domain: 'sleep' }).type).toBe('error');
  });

  it('inits, serves snapshots and series, clamps the day', () => {
    const core = createWorkerCore(() => 0);
    expect(core.handle({ type: 'init', seed: DEMO_SEED }).type).toBe('ready');
    const high = core.handle({ type: 'snapshot', day: 9999 }) as SnapshotResponse;
    expect(high.snapshot.day).toBe(MISSION_DAYS);
    const low = core.handle({ type: 'snapshot', day: 0 }) as SnapshotResponse;
    expect(low.snapshot.day).toBe(1);
    const nan = core.handle({ type: 'snapshot', day: Number.NaN }) as SnapshotResponse;
    expect(nan.snapshot.day).toBe(1);
    const series = core.handle({ type: 'series', crew: 'C', domain: 'sleep' });
    expect(series.type === 'series' && series.series.values.length).toBe(MISSION_DAYS);
  });

  it('rejects unknown crew or domain', () => {
    const core = createWorkerCore(() => 0);
    core.handle({ type: 'init', seed: 1 });
    const bad = core.handle({ type: 'series', crew: 'Z' as never, domain: 'sleep' });
    expect(bad.type).toBe('error');
  });

  it('computes 500 days in under 300 ms', () => {
    const core = createWorkerCore(() => performance.now());
    const t0 = performance.now();
    const res = core.handle({ type: 'init', seed: DEMO_SEED });
    expect(performance.now() - t0).toBeLessThan(300);
    expect(res.type === 'ready' && res.meta.computeMs).toBeLessThan(300);
  });
});
