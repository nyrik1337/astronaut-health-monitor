import { addDetail, checkNotTooLate, parseTimestamp, type Details } from './mockShared';
import type { CognitiveRequest, Session } from './types';

/** MOCK validation of one orbita-rt-1 session (contract "POST /api/cognitive/analyze" rules). */

const VERSION = /^[0-9]+(\.[0-9]+){0,3}$/;
const MAX_DURATION_MS = 150_000;
const MIN_COMPLETED_DURATION_MS = 12_500;
const TRIALS = 20;

function checkTrials(details: Details, s: Session, path: string): void {
  const bad = (message: string) => addDetail(details, `${path}.trials`, 'INVALID_TRIALS', message);
  s.trials.forEach((t, i) => {
    if (t.index !== i + 1) bad('Trial indexes must be consecutive from 1.');
    if (!Number.isInteger(t.wait_ms) || t.wait_ms < 1000 || t.wait_ms > 3000) bad('wait_ms must be 1000–3000.');
    const rt = t.reaction_time_ms;
    if (t.outcome === 'response' && (rt === null || rt < 100 || rt > 1500)) bad('A response needs a time in [100, 1500] ms.');
    if (t.outcome !== 'response' && rt !== null) bad('Early and missed trials have no reaction time.');
  });
  if (new Set(s.interruptions).size !== s.interruptions.length) bad('Interruption codes must be unique.');
  if (s.completion === 'completed' && (s.trials.length !== TRIALS || s.interruptions.length > 0)) {
    bad('A completed session has exactly 20 trials and no interruptions.');
  }
  if (s.completion === 'aborted' && (s.trials.length >= TRIALS || s.interruptions.length === 0)) {
    bad('An aborted session has 0–19 trials and at least one interruption.');
  }
}

/** Returns the session start in ms (or null) after adding any validation details. */
export function validateSession(
  details: Details,
  s: Session,
  path: string,
  req: CognitiveRequest,
  asOfMs: number | null,
): number | null {
  if (s.subject_id !== req.subject_id) {
    addDetail(details, `${path}.subject_id`, 'SUBJECT_MISMATCH', 'Session subject differs from the request subject.');
  }
  if (s.clock.kind !== req.clock.kind || s.clock.id !== req.clock.id) {
    addDetail(details, `${path}.clock`, 'CLOCK_MISMATCH', 'Session clock differs from the request clock.');
  }
  const allowed = req.mode === 'simulation' ? 'simulated' : 'browser_measured';
  if (s.source.kind !== allowed) {
    addDetail(details, `${path}.source.kind`, 'PROVENANCE_MODE_MISMATCH', `Sessions must be ${allowed} in this mode.`);
  }
  const start = parseTimestamp(details, `${path}.started_at`, s.started_at);
  const end = parseTimestamp(details, `${path}.ended_at`, s.ended_at);
  checkNotTooLate(details, `${path}.started_at`, start, asOfMs);
  checkNotTooLate(details, `${path}.ended_at`, end, asOfMs);
  if (start !== null && end !== null) {
    const duration = end - start;
    const tooShort = s.completion === 'completed' && duration < MIN_COMPLETED_DURATION_MS;
    if (duration < 0 || duration > MAX_DURATION_MS || tooShort) {
      addDetail(details, `${path}.ended_at`, 'INVALID_SESSION_INTERVAL', 'Session duration is outside protocol bounds.');
    }
  }
  for (const key of ['browser_version', 'os_version'] as const) {
    const value = s.context[key];
    if (value.length > 128 || !VERSION.test(value)) {
      addDetail(details, `${path}.context.${key}`, 'INVALID_VALUE', 'Version must have 1–4 numeric components.');
    }
  }
  checkTrials(details, s, path);
  return start;
}
