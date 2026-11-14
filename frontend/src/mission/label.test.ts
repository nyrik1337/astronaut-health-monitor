// Ground-truth labelling: an alert matches a scenario only by crew member, domain and day.
import { describe, expect, it } from 'vitest';
import { labelAlert } from './label';
import { SCENARIO_EVENTS } from './scenarios';
import type { Alert } from './types';

const base: Alert = {
  synthetic: true,
  id: 'x',
  detectedDay: 60,
  day: 60,
  crew: 'B',
  affected: ['B'],
  domain: 'sleep',
  category: 'sustained_deviation',
  scope: 'personal',
  kind: 'drift',
  direction: 'down',
  title: '',
  text: '',
  falsePositive: false,
  scenarioId: null,
  reviewFlaggedDay: null,
  closedDay: null,
  finalOutcome: 'open',
  followUpText: null,
};

describe('labelAlert', () => {
  it('links a matching alert to its scenario', () => {
    const r = labelAlert(base, SCENARIO_EVENTS);
    expect(r.scenarioId).toBe('sleep-drift-b');
    expect(r.falsePositive).toBe(false);
  });

  it('marks other crew, other domain or other day as false positive', () => {
    expect(labelAlert({ ...base, crew: 'A', affected: ['A'] }, SCENARIO_EVENTS).falsePositive).toBe(
      true,
    );
    expect(labelAlert({ ...base, domain: 'cardio' }, SCENARIO_EVENTS).falsePositive).toBe(true);
    expect(labelAlert({ ...base, detectedDay: 200 }, SCENARIO_EVENTS).falsePositive).toBe(true);
  });

  it('matches group alerts by affected crew', () => {
    const group: Alert = {
      ...base,
      crew: null,
      affected: ['A', 'C', 'D'],
      detectedDay: 122,
      scope: 'group',
      kind: 'group',
      category: 'multiple_signals',
    };
    expect(labelAlert(group, SCENARIO_EVENTS).scenarioId).toBe('module-co2');
  });
});
