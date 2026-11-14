import { describe, expect, test } from 'vitest';
import type { AlertView, DetectionView } from '../mission/types';
import { delayText, detectionStatusText, formatSigned, waitingText } from './labels';

const alert = (overrides: Partial<AlertView>): AlertView => ({
  synthetic: true,
  id: 'drift-B-sleep-64',
  detectedDay: 64,
  day: 67,
  crew: 'B',
  affected: ['B'],
  domain: 'sleep',
  category: 'sustained_deviation',
  scope: 'personal',
  kind: 'drift',
  direction: 'down',
  title: 't',
  text: 't',
  falsePositive: false,
  scenarioId: null,
  reviewFlaggedDay: null,
  closedDay: null,
  finalOutcome: 'open',
  followUpText: null,
  outcome: 'open',
  ...overrides,
});

const detection = (status: DetectionView['status']): DetectionView => ({
  id: 'drift-B-sleep-64',
  crew: 'B',
  domain: 'sleep',
  kind: 'drift',
  day: 64,
  direction: 'down',
  disposition: 'alert',
  alertId: 'drift-B-sleep-64',
  decisionDay: 67,
  status,
});

describe('mission view labels', () => {
  test('explains why a notification came after its detection', () => {
    expect(delayText(alert({}))).toBe('Detected on day 64; held 3 days for a grouping check.');
    expect(delayText(alert({ day: 69 }))).toBe(
      'Detected on day 64; held 3 days for a grouping check, deferred 2 days by the alert budget.',
    );
    expect(delayText(alert({ kind: 'outlier', detectedDay: 210, day: 211 }))).toBe(
      'Detected on day 210; deferred 1 day by the alert budget.',
    );
    expect(delayText(alert({ detectedDay: 210, day: 210, kind: 'outlier' }))).toBeNull();
  });

  test('explains why an item is still waiting', () => {
    expect(waitingText(alert({}), 65)).toBe('Detected on day 64; grouping check until day 67.');
    expect(waitingText(alert({ day: 70 }), 68)).toBe(
      'Detected on day 64; waiting for the daily alert budget.',
    );
  });

  test('describes every detection status', () => {
    expect(detectionStatusText(detection('pending_grouping_check'), null)).toBe(
      'Pending: grouping check until day 67',
    );
    expect(detectionStatusText(detection('notified'), 67)).toBe('Notified on day 67');
    expect(detectionStatusText(detection('queued'), null)).toContain('alert budget');
    expect(detectionStatusText(detection('grouped'), null)).toContain('multiple-signals');
    expect(detectionStatusText(detection('merged_into_open_alert'), null)).toContain('open notification');
    expect(detectionStatusText(detection('covered_by_environmental_event'), null)).toContain(
      'particle event',
    );
  });

  test('formats signed values with a true minus sign', () => {
    expect(formatSigned(-1.234)).toBe('−1.23');
    expect(formatSigned(0.5)).toBe('+0.50');
    expect(formatSigned(null)).toBe('—');
  });
});
