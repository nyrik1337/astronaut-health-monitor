// Alert budget: overload, environmental events outside the budget, group alerts, no removal.
import { describe, expect, it } from 'vitest';
import { applyBudget, NOT_SHOWN_DAY } from './budget';
import { MISSION_DAYS } from './types';
import type { Alert, AlertCategory, CrewId } from './types';

function make(
  id: string,
  crew: CrewId | null,
  category: AlertCategory,
  detectedDay: number,
  affected?: CrewId[],
): Alert {
  const environment = category === 'environmental_event';
  return {
    synthetic: true,
    id,
    detectedDay,
    day: detectedDay,
    crew,
    affected: affected ?? (crew ? [crew] : []),
    domain: 'sleep',
    category,
    scope: crew ? 'personal' : environment ? 'environment' : 'group',
    kind: crew ? 'drift' : environment ? 'environmental_event' : 'group',
    direction: 'down',
    title: id,
    text: id,
    falsePositive: false,
    scenarioId: null,
    reviewFlaggedDay: null,
    closedDay: null,
    finalOutcome: 'open',
    followUpText: null,
  };
}

const shownOn = (alerts: Alert[], id: string): number | undefined =>
  alerts.find((a) => a.id === id)?.day;

describe('applyBudget', () => {
  it('spreads 5 alerts of one person over 2,2,1 days in review order', () => {
    const alerts = [
      make('a1', 'A', 'short_term_deviation', 10),
      make('a2', 'A', 'sustained_deviation', 10),
      make('a3', 'A', 'short_term_deviation', 10),
      make('a4', 'A', 'requires_human_review', 10),
      make('a5', 'A', 'short_term_deviation', 10),
    ];
    const out = applyBudget(alerts, 2);
    const days = out.map((a) => a.day);
    expect(days.filter((d) => d === 10)).toHaveLength(2);
    expect(days.filter((d) => d === 11)).toHaveLength(2);
    expect(days.filter((d) => d === 12)).toHaveLength(1);
    expect(
      out
        .filter((a) => a.day === 10)
        .map((a) => a.id)
        .sort(),
    ).toEqual(['a2', 'a4']);
  });

  it('does not delay environmental events and does not count them', () => {
    const alerts = [
      make('s', null, 'environmental_event', 10, ['A', 'B', 'C', 'D']),
      make('a1', 'A', 'sustained_deviation', 10),
      make('a2', 'A', 'sustained_deviation', 10),
    ];
    const out = applyBudget(alerts, 2);
    expect(out.every((a) => a.day === 10)).toBe(true);
  });

  it('a group alert counts against every affected person', () => {
    const alerts = [
      make('m', null, 'multiple_signals', 10, ['A', 'C', 'D']),
      make('a1', 'A', 'short_term_deviation', 10),
      make('a2', 'A', 'short_term_deviation', 10),
    ];
    const out = applyBudget(alerts, 2);
    expect(shownOn(out, 'm')).toBe(10);
    expect(out.filter((a) => a.day === 10)).toHaveLength(2);
    expect(Math.max(...out.map((a) => a.day))).toBe(11);
  });

  it('never removes an alert: unschedulable ones stay with day after the mission', () => {
    const alerts = [make('a', 'B', 'short_term_deviation', 20)];
    const out = applyBudget(alerts, 2);
    expect(shownOn(out, 'a')).toBe(20);
    expect(alerts[0]?.day).toBe(20);
    expect(applyBudget([], 2)).toEqual([]);
    const late = applyBudget(
      [
        make('x1', 'A', 'short_term_deviation', MISSION_DAYS),
        make('x2', 'A', 'short_term_deviation', MISSION_DAYS),
        make('x3', 'A', 'short_term_deviation', MISSION_DAYS),
      ],
      2,
    );
    expect(late).toHaveLength(3);
    expect(late.filter((a) => a.day === NOT_SHOWN_DAY)).toHaveLength(1);
  });
});
