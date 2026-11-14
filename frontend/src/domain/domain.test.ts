import { describe, expect, test } from 'vitest';
import type { MetricResult } from '../api/types';
import { partialResponse } from '../test/fixtures';
import { analysisForReading, metricAnalysisView, signedDifference } from './analysisView';
import { computeYDomain } from './chartDomain';
import { formatClock, formatDateTime, formatNumber, formatSigned, isSameInstant, withUnit } from './format';
import { baselineMethodLabel, describeMetricResult } from './labels';
import { getMetricDefinition } from './metrics';

const TIMESTAMP = '2026-10-04T14:30:00.000Z';

describe('format', () => {
  test('formats numbers with a true minus sign and fixed decimals', () => {
    expect(formatNumber(36.66, 1)).toBe('36.7');
    expect(formatNumber(-0.04, 1)).toBe('0.0');
    expect(formatNumber(-2.5, 1)).toBe('−2.5');
  });

  test('formatSigned always shows the sign except for zero', () => {
    expect(formatSigned(4, 1)).toBe('+4.0');
    expect(formatSigned(-0.3, 1)).toBe('−0.3');
    expect(formatSigned(0.001, 1)).toBe('0.0');
  });

  test('formats times in UTC and appends units', () => {
    expect(formatClock(TIMESTAMP)).toBe('14:30');
    expect(formatDateTime(TIMESTAMP)).toBe('04 Oct 2026, 14:30 UTC');
    expect(withUnit('98', '%')).toBe('98 %');
    expect(withUnit('3.2', '')).toBe('3.2');
  });

  test('isSameInstant compares instants, not strings', () => {
    expect(isSameInstant('2026-10-04T14:30:00Z', TIMESTAMP)).toBe(true);
    expect(isSameInstant('2026-10-04T16:30:00+02:00', TIMESTAMP)).toBe(true);
    expect(isSameInstant('not a date', 'not a date')).toBe(false);
  });
});

describe('computeYDomain', () => {
  test('includes the median and pads a flat series', () => {
    expect(computeYDomain([98, 98, 98], 98, 0)).toEqual([97, 99]);
    expect(computeYDomain([60, 70], 80, 0)).toEqual([56, 84]);
  });

  test('returns null when there is nothing to plot', () => {
    expect(computeYDomain([], null, 1)).toBeNull();
  });
});

describe('labels', () => {
  const base: MetricResult = { current: 36.7, status: 'insufficient_history', history_samples: 4, baseline: null, deviation: null };

  test('describes each metric status using contract numbers only', () => {
    expect(describeMetricResult({ ...base, status: 'analyzed', history_samples: 5 }, 5)).toBe('Compared with the median of 5 valid history values.');
    expect(describeMetricResult({ ...base, status: 'zero_variability', history_samples: 1 }, 5)).toMatch(/1 valid history value\. MAD is zero/);
    expect(describeMetricResult(base, 5)).toBe('4 valid history values on record; at least 5 are needed for a baseline in this demonstration.');
    expect(describeMetricResult({ ...base, status: 'missing_current', current: null }, 5)).toMatch(/no value for this metric/);
  });

  test('labels known baseline methods and passes unknown ones through', () => {
    expect(baselineMethodLabel('median_mad')).toMatch(/Median/);
    expect(baselineMethodLabel('future_method')).toBe('future_method');
  });

  test('falls back to the raw key for metrics outside the demo set', () => {
    expect(getMetricDefinition('respiration_rate_bpm')).toEqual({ key: 'respiration_rate_bpm', label: 'respiration_rate_bpm', unit: '', decimals: 2 });
    expect(getMetricDefinition('spo2_percent').unit).toBe('%');
  });
});

describe('analysisView', () => {
  const response = partialResponse('2026-10-04T14:30:00Z');
  const current = { timestamp: TIMESTAMP, measurements: { heart_rate_bpm: 74 } };

  test('only uses a successful response whose timestamp matches the current reading', () => {
    expect(analysisForReading({ phase: 'success', data: response }, current)).toBe(response);
    expect(analysisForReading({ phase: 'success', data: response }, { ...current, timestamp: '2026-10-04T15:00:00Z' })).toBeNull();
    expect(analysisForReading({ phase: 'loading' }, current)).toBeNull();
    expect(analysisForReading({ phase: 'success', data: response }, null)).toBeNull();
  });

  test('maps state to a per-metric view', () => {
    const success = { phase: 'success', data: response } as const;

    expect(metricAnalysisView(success, response, 'heart_rate_bpm')).toMatchObject({ kind: 'ready', minimumSamples: 5 });
    expect(metricAnalysisView(success, response, 'unknown_metric')).toMatchObject({ kind: 'unavailable' });
    expect(metricAnalysisView({ phase: 'loading' }, null, 'heart_rate_bpm')).toEqual({ kind: 'pending' });
    expect(metricAnalysisView({ phase: 'idle' }, null, 'heart_rate_bpm')).toMatchObject({ kind: 'unavailable' });
  });

  test('signedDifference restores the direction of the absolute deviation', () => {
    const analyzed = response.metrics.heart_rate_bpm;
    expect(analyzed && signedDifference(analyzed)).toBe(4);
    expect(analyzed && signedDifference({ ...analyzed, current: 66 })).toBe(-4);
    expect(signedDifference({ current: 1, status: 'insufficient_history', history_samples: 0, baseline: null, deviation: null })).toBeNull();
  });
});
