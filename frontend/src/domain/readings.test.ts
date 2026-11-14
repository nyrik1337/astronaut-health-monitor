import { describe, expect, test } from 'vitest';
import { appendReading, buildAnalyzeRequest, countMissing, type Reading, toSeries } from './readings';

function reading(minute: number, measurements: Reading['measurements']): Reading {
  return { timestamp: new Date(Date.UTC(2026, 9, 4, 12, minute)).toISOString(), measurements };
}

describe('buildAnalyzeRequest', () => {
  test('uses the newest reading as current and earlier readings as ascending history', () => {
    const readings = [reading(0, { heart_rate_bpm: 70 }), reading(1, { heart_rate_bpm: null }), reading(2, { heart_rate_bpm: 72 })];

    const request = buildAnalyzeRequest('crew-01', readings);

    expect(request).toEqual({
      subject_id: 'crew-01',
      timestamp: readings[2]?.timestamp,
      measurements: { heart_rate_bpm: 72 },
      history: [
        { timestamp: readings[0]?.timestamp, measurements: { heart_rate_bpm: 70 } },
        { timestamp: readings[1]?.timestamp, measurements: { heart_rate_bpm: null } },
      ],
    });
  });

  test('submits no more than the latest maxHistory records', () => {
    const readings = Array.from({ length: 6 }, (_, i) => reading(i, { heart_rate_bpm: 60 + i }));

    const request = buildAnalyzeRequest('crew-01', readings, 3);

    expect(request?.history.map((h) => h.measurements.heart_rate_bpm)).toEqual([62, 63, 64]);
  });

  test('returns null when there is no reading or the current reading has no metrics', () => {
    expect(buildAnalyzeRequest('crew-01', [])).toBeNull();
    expect(buildAnalyzeRequest('crew-01', [reading(0, {})])).toBeNull();
  });
});

describe('appendReading', () => {
  test('returns a new array without mutating the input', () => {
    const original = [reading(0, { heart_rate_bpm: 70 })];

    const next = appendReading(original, reading(1, { heart_rate_bpm: 71 }));

    expect(next).toHaveLength(2);
    expect(original).toHaveLength(1);
  });

  test('rejects readings that are not strictly later than the newest one', () => {
    const original = [reading(5, { heart_rate_bpm: 70 })];

    expect(() => appendReading(original, reading(5, { heart_rate_bpm: 71 }))).toThrow(/later/);
    expect(() => appendReading(original, reading(4, { heart_rate_bpm: 71 }))).toThrow(/later/);
  });

  test('drops the oldest readings beyond the retention limit', () => {
    const original = [reading(0, { a: 1 }), reading(1, { a: 2 })];

    const next = appendReading(original, reading(2, { a: 3 }), 2);

    expect(next.map((r) => r.measurements.a)).toEqual([2, 3]);
  });
});

describe('toSeries and countMissing', () => {
  test('turns null and absent values into gaps', () => {
    const series = toSeries([reading(0, { a: 1 }), reading(1, { a: null }), reading(2, {})], 'a');

    expect(series.map((point) => point.value)).toEqual([1, null, null]);
    expect(series[0]?.time).toBe(Date.UTC(2026, 9, 4, 12, 0));
    expect(countMissing(series)).toBe(2);
  });
});
