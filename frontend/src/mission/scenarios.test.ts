// Seed 2026 scenarios: the detectors must find them from the data, not from the scenario list.
import { describe, expect, it } from 'vitest';
import { runMission } from './mission';
import { snapshotAt } from './snapshot';
import { CUSUM_H, DEMO_SEED } from './types';
import type { Alert } from './types';

const mission = runMission(DEMO_SEED);
const find = (pred: (a: Alert) => boolean): Alert[] => mission.alerts.filter(pred);
const only = (alerts: Alert[]): Alert => {
  expect(alerts).toHaveLength(1);
  const alert = alerts[0];
  if (alert === undefined) throw new Error('expected one alert');
  return alert;
};
const viewOn = (day: number, id: string) =>
  snapshotAt(mission, day).alerts.find((a) => a.id === id);

describe('determinism', () => {
  it('same seed gives deep-equal missions', () => {
    expect(runMission(DEMO_SEED)).toEqual(mission);
  });

  it('different seed gives different values', () => {
    expect(runMission(7).generated.values.A.sleep).not.toEqual(mission.generated.values.A.sleep);
  });
});

describe('days 40-80: slow sleep drift of B', () => {
  it('CUSUM fires before the first |z| > 3 and a sustained deviation follows', () => {
    const a = mission.analysis.B.sleep;
    const cusumDay = a.cusumLo.findIndex((v) => v !== null && v > CUSUM_H) + 1;
    const zIdx = a.z.findIndex((v, i) => i >= 39 && v !== null && Math.abs(v) > 3);
    const zDay = zIdx === -1 ? Infinity : zIdx + 1;
    expect(cusumDay).toBeGreaterThanOrEqual(40);
    expect(cusumDay).toBeLessThan(zDay);
    const alert = only(find((x) => x.crew === 'B' && x.scenarioId === 'sleep-drift-b'));
    expect(alert.category).toBe('sustained_deviation');
    expect(alert.detectedDay).toBeGreaterThanOrEqual(40);
    expect(alert.day).toBeLessThanOrEqual(80);
  });

  it('still outside the range after both checks, so it is flagged for human review', () => {
    const alert = only(find((x) => x.scenarioId === 'sleep-drift-b'));
    expect(alert.reviewFlaggedDay).not.toBeNull();
    const view = viewOn(alert.reviewFlaggedDay ?? 0, alert.id);
    expect(view?.category).toBe('requires_human_review');
    expect(view?.outcome).toBe('flagged_for_review');
    expect(view?.followUpText).toContain('Flagged for human review');
  });
});

describe('day 120: simultaneous sleep shift with a CO2 rise', () => {
  it('forms exactly one group and no personal sustained alerts for A, C, D', () => {
    const group = only(find((a) => a.scope === 'group' && a.day >= 118 && a.day <= 132));
    expect(group.crew).toBeNull();
    expect(group.affected).toEqual(['A', 'C', 'D']);
    expect(group.category).toBe('multiple_signals');
    const sustained = find(
      (a) =>
        a.scope === 'personal' &&
        a.domain === 'sleep' &&
        ['A', 'C', 'D'].includes(a.crew ?? '') &&
        a.category !== 'short_term_deviation' &&
        a.detectedDay >= 118 &&
        a.detectedDay <= 135,
    );
    expect(sustained).toHaveLength(0);
  });

  it('shows the group at day 130 without claiming a cause', () => {
    const view = snapshotAt(mission, 130).alerts.find((a) => a.scope === 'group');
    expect(view?.text).toContain('grouped into one item');
    expect(view?.text).toContain('does not establish a cause');
  });
});

describe('day 210: sensor artifact', () => {
  it('stays a short-term deviation in alerts and in the grid', () => {
    const near = find(
      (a) =>
        a.crew === 'A' && a.domain === 'cardio' && a.detectedDay >= 208 && a.detectedDay <= 215,
    );
    expect(near.length).toBeGreaterThan(0);
    for (const a of near) expect(a.category).toBe('short_term_deviation');
    for (let day = 209; day <= 215; day++) {
      expect(['within_baseline', 'short_term_deviation']).toContain(mission.grid[day - 1]?.[0]?.[0]);
    }
    expect(near.some((a) => a.kind === 'outlier')).toBe(true);
  });
});

describe('day 300: simulated particle event', () => {
  it('is a separate environmental event with an event dose below the reference', () => {
    expect([299, 300, 301, 302].map((d) => mission.environmentalEventDays[d])).toEqual([
      true,
      true,
      true,
      false,
    ]);
    const event = only(find((a) => a.scope === 'environment'));
    expect(event.category).toBe('environmental_event');
    expect(event.day).toBe(300);
    const env = snapshotAt(mission, 301).environment;
    expect(env.particleEventActive).toBe(true);
    expect(env.eventDoseMSv).toBeGreaterThan(0);
    expect(env.eventDoseMSv).toBeLessThan(250);
    expect(snapshotAt(mission, 100).environment.eventDoseMSv).toBe(0);
    expect(snapshotAt(mission, 400).environment.particleEventActive).toBe(false);
    expect(snapshotAt(mission, 400).environment.eventDoseMSv).toBeGreaterThan(env.eventDoseMSv - 1);
  });

  it('records personal radiation detections as covered instead of raising alerts', () => {
    const personal = find(
      (a) =>
        a.scope === 'personal' &&
        a.domain === 'radiation' &&
        a.detectedDay >= 295 &&
        a.detectedDay <= 325,
    );
    expect(personal).toHaveLength(0);
    const covered = mission.detections.filter(
      (d) => d.disposition === 'covered_by_environmental_event',
    );
    expect(covered.length).toBeGreaterThan(0);
    expect(covered.every((d) => d.alertId === 'environment-300')).toBe(true);
  });
});

describe('day 380: C returns to range', () => {
  it('closes with outcome returned_to_range between days 378 and 384', () => {
    const alert = only(find((a) => a.scenarioId === 'return-to-range-c'));
    expect(alert.crew).toBe('C');
    expect(alert.detectedDay).toBeLessThan(380);
    expect(alert.finalOutcome).toBe('returned_to_range');
    expect(alert.closedDay).toBeGreaterThanOrEqual(378);
    expect(alert.closedDay).toBeLessThanOrEqual(384);
    const view = viewOn(385, alert.id);
    expect(view?.outcome).toBe('returned_to_range');
    expect(view?.followUpText).toContain('not its cause');
  });
});

describe('false alarms', () => {
  it('are few but present, and every scenario is detected', () => {
    const fp = mission.alerts.filter((a) => a.falsePositive).length;
    expect(fp).toBeGreaterThanOrEqual(1);
    expect(fp).toBeLessThanOrEqual(8);
    const ids = new Set(mission.alerts.filter((a) => !a.falsePositive).map((a) => a.scenarioId));
    for (const id of [
      'sleep-drift-b',
      'module-co2',
      'hr-artifact',
      'solar-storm',
      'return-to-range-c',
    ] as const) {
      expect(ids.has(id)).toBe(true);
    }
  });
});
