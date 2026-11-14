import { ApiError } from '../api/errors';
import type { ValidationDetail } from '../api/types';
import {
  DEMO_POLICY,
  type Clock,
  type EvidenceItem,
  type EvidenceKind,
  type Mode,
  type NoticeInput,
  type NoticeOutput,
  type Observation,
  type Provenance,
} from './types';

/**
 * Shared rules for the contract-based MOCK of the evidence/cognitive routes. It exists only
 * until the backend implements them; the backend remains the authority for validation and
 * arithmetic. It follows docs/API_CONTRACT.md (`evidence-cognitive-1`) as closely as practical.
 */

export const AS_OF_TOLERANCE_MS = 300_000;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

export type Details = ValidationDetail[];

export function addDetail(details: Details, field: string, code: string, message: string): void {
  details.push({ field, code, message });
}

export function validationError(details: Details): ApiError {
  return new ApiError({
    kind: 'http',
    status: 422,
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed.',
    details,
  });
}

/** Instant in ms, or null (with an INVALID_TIMESTAMP detail) when the string is not valid RFC 3339. */
export function parseTimestamp(details: Details, field: string, value: string): number | null {
  const ms = Date.parse(value);
  if (!RFC3339.test(value) || value.endsWith('-00:00') || Number.isNaN(ms)) {
    addDetail(details, field, 'INVALID_TIMESTAMP', 'Timestamp must be RFC 3339 with an explicit offset.');
    return null;
  }
  return ms;
}

/** UTC form with Z; whole seconds are written without a fraction. */
export const isoZ = (ms: number): string => new Date(ms).toISOString().replace('.000Z', 'Z');
export const round3 = (value: number): number => Math.round(value * 1000) / 1000;

export function checkModeClock(
  details: Details,
  mode: Mode,
  clock: Clock,
  asOfMs: number | null,
  receiptMs: number,
): void {
  if (mode === 'simulation' && clock.kind !== 'mission') {
    addDetail(details, 'clock.kind', 'CLOCK_MISMATCH', 'Simulation mode requires a mission clock.');
  }
  if (mode === 'real_assessment') {
    if (clock.kind !== 'utc' || clock.id !== 'utc') {
      addDetail(details, 'clock', 'CLOCK_MISMATCH', 'Real assessment requires the UTC clock.');
    }
    if (asOfMs !== null && Math.abs(asOfMs - receiptMs) > AS_OF_TOLERANCE_MS) {
      addDetail(details, 'as_of', 'AS_OF_OUT_OF_RANGE', 'as_of must be within 300 seconds of receipt time.');
    }
  }
}

/** Which provenance a mode accepts for general evidence (cognitive sessions are stricter). */
export function evidenceSourceAllowed(mode: Mode, kind: Provenance, evidenceKind?: EvidenceKind): boolean {
  if (kind === 'research_dataset') return false;
  if (mode === 'simulation') return kind === 'simulated';
  if (evidenceKind === 'cognitive_test') return kind === 'browser_measured';
  return kind === 'real_device' || kind === 'human_entered' || kind === 'browser_measured';
}

export function checkNotTooLate(
  details: Details,
  field: string,
  ms: number | null,
  asOfMs: number | null,
): void {
  if (ms !== null && asOfMs !== null && ms > asOfMs) {
    addDetail(details, field, 'FUTURE_OBSERVATION', 'Timestamp must not be later than as_of.');
  }
}

const VALUE_BOUNDS: Record<EvidenceKind, (v: number) => boolean> = {
  heart_rate: (v) => v > 0,
  sleep_duration: (v) => v >= 0 && v <= 24,
  cognitive_test: (v) => v > 0 && v <= 1500,
};

export function validateObservation(
  details: Details,
  o: Observation,
  path: string,
  mode: Mode,
  asOfMs: number | null,
): void {
  const ms = parseTimestamp(details, `${path}.observed_at`, o.observed_at);
  checkNotTooLate(details, `${path}.observed_at`, ms, asOfMs);
  if (!evidenceSourceAllowed(mode, o.source.kind, o.kind)) {
    addDetail(details, `${path}.source.kind`, 'PROVENANCE_MODE_MISMATCH', 'Source is not allowed in this mode.');
  }
  if (o.value !== null && (!Number.isFinite(o.value) || !VALUE_BOUNDS[o.kind](o.value))) {
    addDetail(details, `${path}.value`, 'INVALID_VALUE', 'Value is outside the data bounds for this kind.');
  }
  const needsReasons = o.quality.status === 'poor';
  if (needsReasons !== o.quality.reasons.length > 0) {
    addDetail(details, `${path}.quality.reasons`, 'INVALID_VALUE', 'Poor quality needs reasons; other statuses none.');
  }
}

export function validateNotices(
  details: Details,
  notices: readonly NoticeInput[],
  mode: Mode,
  asOfMs: number | null,
): void {
  if (notices.length > 16) addDetail(details, 'notices', 'LIMIT_EXCEEDED', 'At most 16 notices.');
  notices.forEach((n, i) => {
    const ms = parseTimestamp(details, `notices.${i}.reported_at`, n.reported_at);
    checkNotTooLate(details, `notices.${i}.reported_at`, ms, asOfMs);
    if (!evidenceSourceAllowed(mode, n.source.kind)) {
      addDetail(details, `notices.${i}.source.kind`, 'PROVENANCE_MODE_MISMATCH', 'Source is not allowed in this mode.');
    }
  });
}

export const echoNotices = (notices: readonly NoticeInput[]): NoticeOutput[] =>
  notices.map((n) => ({
    id: n.id,
    reported_at: isoZ(Date.parse(n.reported_at)),
    source: n.source,
    text: n.text,
    verification: 'unverified_client_input',
  }));

/** Evidence item for a supplied observation; issues in contract order, status by precedence. */
export function evaluateObservation(o: Observation, asOfMs: number): EvidenceItem {
  const observedMs = Date.parse(o.observed_at);
  const age = round3((asOfMs - observedMs) / 1000);
  const issues: EvidenceItem['issues'] = [];
  if (o.value === null) issues.push('missing_data');
  if (age > DEMO_POLICY.freshness_seconds[o.kind]) issues.push('stale_data');
  if (o.quality.status === 'poor') issues.push('poor_quality');
  if (o.quality.status === 'unknown') issues.push('quality_unknown');
  const status = issues.includes('missing_data')
    ? 'missing_data'
    : issues.includes('stale_data')
      ? 'stale_data'
      : issues.includes('poor_quality')
        ? 'poor_quality'
        : 'available';
  return {
    kind: o.kind,
    status,
    observed_at: isoZ(observedMs),
    value: o.value,
    source: o.source,
    quality: o.quality,
    age_seconds: age,
    issues,
  };
}

export const absentItem = (kind: EvidenceKind): EvidenceItem => ({
  kind,
  status: 'missing_data',
  observed_at: null,
  value: null,
  source: null,
  quality: null,
  age_seconds: null,
  issues: ['missing_data'],
});
