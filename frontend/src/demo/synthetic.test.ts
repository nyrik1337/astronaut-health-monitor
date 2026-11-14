import { describe, expect, test } from 'vitest';
import { buildAnalyzeRequest } from '../domain/readings';
import { DEMO_SUBJECT_ID, generateScenario, nextSyntheticReading, SCENARIOS, syntheticMeasurements } from './synthetic';

const NOW = new Date('2026-10-04T14:47:12Z');
const METRIC_NAME = /^[a-z][a-z0-9_]{0,63}$/;

describe('synthetic demo readings', () => {
  test('are deterministic for a given index', () => {
    expect(syntheticMeasurements(7)).toEqual(syntheticMeasurements(7));
  });

  test.each(SCENARIOS.map((s) => [s.id, s.readingCount] as const))(
    'scenario %s produces %i strictly ascending readings with contract-valid metric names',
    (id, count) => {
      const readings = generateScenario(id, NOW);
      const times = readings.map((r) => Date.parse(r.timestamp));

      expect(readings).toHaveLength(count);
      expect(times.every((t, i) => i === 0 || t > (times[i - 1] ?? Infinity))).toBe(true);
      expect(readings.at(-1)?.timestamp).toBe('2026-10-04T14:30:00.000Z');
      for (const r of readings) {
        for (const [key, value] of Object.entries(r.measurements)) {
          expect(key).toMatch(METRIC_NAME);
          expect(value === null || Number.isFinite(value)).toBe(true);
        }
      }
    },
  );

  test('short history leaves fewer than five history values before the current reading', () => {
    const request = buildAnalyzeRequest(DEMO_SUBJECT_ID, generateScenario('short_history', NOW));

    expect(request?.history).toHaveLength(3);
  });

  test('sensor gaps include an empty record, absent keys and a null current SpO₂', () => {
    const readings = generateScenario('sensor_gaps', NOW);

    expect(readings[5]?.measurements).toEqual({});
    expect(readings[17]?.measurements).not.toHaveProperty('body_temperature_c');
    expect(readings.at(-1)?.measurements.spo2_percent).toBeNull();
  });

  test('no current data nulls every current value but keeps the keys', () => {
    const current = generateScenario('no_current_data', NOW).at(-1);

    expect(Object.values(current?.measurements ?? {})).toEqual([null, null, null]);
  });

  test('the next reading is 30 minutes later and can omit chosen metrics', () => {
    const readings = generateScenario('steady', NOW);

    const next = nextSyntheticReading(readings, NOW, { missing: ['spo2_percent'] });

    expect(Date.parse(next.timestamp) - Date.parse(readings.at(-1)?.timestamp ?? '')).toBe(30 * 60_000);
    expect(next.measurements.spo2_percent).toBeNull();
    expect(typeof next.measurements.heart_rate_bpm).toBe('number');
    expect(nextSyntheticReading([], NOW).timestamp).toBe('2026-10-04T14:30:00.000Z');
  });

  test('rejects an unknown scenario', () => {
    expect(() => generateScenario('nope' as never, NOW)).toThrow(/Unknown demo scenario/);
  });
});
