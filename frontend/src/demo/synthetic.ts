import type { Measurements } from '../api/types';
import type { Reading } from '../domain/readings';

/**
 * SYNTHETIC DEMO DATA. Everything in this module is generated in the browser for demonstration.
 * The values are not from a real person or sensor, and the generator's centre values are not
 * clinical reference ranges or thresholds.
 */

export const DEMO_SUBJECT_ID = 'demo-subject-01';
export const DEMO_INTERVAL_MINUTES = 30;
const INTERVAL_MS = DEMO_INTERVAL_MINUTES * 60_000;
const SEED = 20261004;

export type ScenarioId = 'steady' | 'short_history' | 'sensor_gaps' | 'no_current_data';

export interface ScenarioDefinition {
  readonly id: ScenarioId;
  readonly label: string;
  readonly description: string;
  readonly readingCount: number;
}

export const SCENARIOS: readonly ScenarioDefinition[] = [
  {
    id: 'steady',
    label: 'Steady history',
    description: '24 synthetic readings at 30-minute intervals, with one missing temperature value.',
    readingCount: 24,
  },
  {
    id: 'short_history',
    label: 'Short history',
    description: '4 synthetic readings: only 3 history values exist before the current reading.',
    readingCount: 4,
  },
  {
    id: 'sensor_gaps',
    label: 'Sensor gaps',
    description: '24 synthetic readings with gaps in history and no current SpO₂ value.',
    readingCount: 24,
  },
  {
    id: 'no_current_data',
    label: 'No current data',
    description: '12 synthetic readings; the current reading has no value for any metric.',
    readingCount: 12,
  },
];

/** mulberry32 — a small deterministic PRNG so demo data is reproducible. */
function seededUnit(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function noise(index: number, channel: number): number {
  return seededUnit(SEED + index * 7919 + channel * 104729) - 0.5;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Deterministic synthetic values for the reading at position `index`. */
export function syntheticMeasurements(index: number): Measurements {
  return {
    heart_rate_bpm: Math.round(70 + 3 * Math.sin(index / 3) + noise(index, 1) * 6),
    // A percentage cannot exceed 100; this is a unit bound, not a clinical limit.
    spo2_percent: Math.min(100, Math.round(97.6 + noise(index, 2) * 2.4)),
    body_temperature_c: roundTo(36.6 + 0.12 * Math.sin(index / 5) + noise(index, 3) * 0.3, 1),
  };
}

function withNulls(measurements: Measurements, keys: readonly string[]): Measurements {
  return Object.fromEntries(
    Object.entries(measurements).map(([key, value]) => [key, keys.includes(key) ? null : value]),
  );
}

function withoutKeys(measurements: Measurements, keys: readonly string[]): Measurements {
  return Object.fromEntries(Object.entries(measurements).filter(([key]) => !keys.includes(key)));
}

/** Scenario-specific gaps: `null` values and absent keys both occur in real sensor data. */
function applyScenarioGaps(scenario: ScenarioId, index: number, isCurrent: boolean, base: Measurements): Measurements {
  if (scenario === 'steady' && index === 9) {
    return withNulls(base, ['body_temperature_c']);
  }
  if (scenario === 'sensor_gaps') {
    if (isCurrent) return withNulls(base, ['spo2_percent']);
    if (index === 5) return {}; // sensors unavailable for this record
    if (index === 11 || index === 12) return withNulls(base, ['spo2_percent']);
    if (index === 17) return withoutKeys(base, ['body_temperature_c']);
  }
  if (scenario === 'no_current_data' && isCurrent) {
    return withNulls(base, Object.keys(base));
  }
  return base;
}

function alignToInterval(time: Date): number {
  return Math.floor(time.getTime() / INTERVAL_MS) * INTERVAL_MS;
}

export function generateScenario(scenario: ScenarioId, now: Date): readonly Reading[] {
  const definition = SCENARIOS.find((item) => item.id === scenario);
  if (definition === undefined) {
    throw new Error(`Unknown demo scenario: ${scenario}`);
  }
  const end = alignToInterval(now);
  const count = definition.readingCount;
  return Array.from({ length: count }, (_, index) => ({
    timestamp: new Date(end - (count - 1 - index) * INTERVAL_MS).toISOString(),
    measurements: applyScenarioGaps(scenario, index, index === count - 1, syntheticMeasurements(index)),
  }));
}

export interface NextReadingOptions {
  /** Metric keys to report as `null` in the new reading. */
  readonly missing?: readonly string[];
}

/**
 * The next synthetic reading, 30 minutes after the newest one. The current reading always
 * carries every demo metric key (with `null` for missing values), because the contract
 * requires a non-empty `measurements` object.
 */
export function nextSyntheticReading(
  readings: readonly Reading[],
  now: Date,
  options: NextReadingOptions = {},
): Reading {
  const last = readings.at(-1);
  const time = last === undefined ? alignToInterval(now) : Date.parse(last.timestamp) + INTERVAL_MS;
  return {
    timestamp: new Date(time).toISOString(),
    measurements: withNulls(syntheticMeasurements(readings.length), options.missing ?? []),
  };
}
