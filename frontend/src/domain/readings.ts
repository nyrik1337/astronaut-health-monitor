import type { AnalyzeRequest, Measurements } from '../api/types';
import { MAX_HISTORY_RECORDS } from '../config';

/** One raw sample retained by the frontend. The backend is stateless, so this is the source of truth. */
export interface Reading {
  readonly timestamp: string;
  readonly measurements: Measurements;
}

export interface SeriesPoint {
  readonly time: number;
  readonly timestamp: string;
  readonly value: number | null;
}

/** Keep the newest reading plus up to 1,000 history records — everything the contract lets us submit. */
export const MAX_RETAINED_READINGS = MAX_HISTORY_RECORDS + 1;

/** Returns a new array; throws if `next` would break strictly ascending timestamps. */
export function appendReading(
  readings: readonly Reading[],
  next: Reading,
  maxRetained: number = MAX_RETAINED_READINGS,
): readonly Reading[] {
  const last = readings.at(-1);
  if (last !== undefined && Date.parse(next.timestamp) <= Date.parse(last.timestamp)) {
    throw new Error('A new reading must be later than the newest stored reading.');
  }
  const appended = [...readings, next];
  return appended.length > maxRetained ? appended.slice(appended.length - maxRetained) : appended;
}

/**
 * The newest reading becomes `timestamp` + `measurements`; earlier readings become `history`
 * (latest 1,000 at most, ascending). Returns null when there is nothing the contract allows us to send.
 */
export function buildAnalyzeRequest(
  subjectId: string,
  readings: readonly Reading[],
  maxHistory: number = MAX_HISTORY_RECORDS,
): AnalyzeRequest | null {
  const current = readings.at(-1);
  if (current === undefined || Object.keys(current.measurements).length === 0) {
    return null;
  }
  const historyStart = Math.max(0, readings.length - 1 - maxHistory);
  return {
    subject_id: subjectId,
    timestamp: current.timestamp,
    measurements: current.measurements,
    history: readings.slice(historyStart, -1).map((reading) => ({
      timestamp: reading.timestamp,
      measurements: reading.measurements,
    })),
  };
}

/** Absent and null values both become null so the chart shows a gap. */
export function toSeries(readings: readonly Reading[], metricKey: string): readonly SeriesPoint[] {
  return readings.map((reading) => ({
    time: Date.parse(reading.timestamp),
    timestamp: reading.timestamp,
    value: reading.measurements[metricKey] ?? null,
  }));
}

export function countMissing(series: readonly SeriesPoint[]): number {
  return series.filter((point) => point.value === null).length;
}
