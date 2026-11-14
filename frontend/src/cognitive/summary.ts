import { DEMO_POLICY, type Session, type Summary } from './types';

/**
 * Trial accounting for one orbita-rt-1 session: counts derived from outcomes, median and p90 of
 * valid responses (p90 = sorted value at 1-based index ceil(0.9 n)), rounded to 3 decimals.
 * Used by the mock and by the UI to show the browser's own raw counts.
 */

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

export function sessionSummary(session: Session): Summary {
  const valid = session.trials
    .filter((t) => t.outcome === 'response' && t.reaction_time_ms !== null)
    .map((t) => t.reaction_time_ms ?? 0)
    .sort((a, b) => a - b);
  const n = valid.length;
  const mid = n >> 1;
  const median = n === 0 ? null : n % 2 === 1 ? (valid[mid] ?? 0) : ((valid[mid - 1] ?? 0) + (valid[mid] ?? 0)) / 2;
  const p90 = n === 0 ? null : (valid[Math.ceil(0.9 * n) - 1] ?? null);
  return {
    valid_trials: n,
    missed_responses: session.trials.filter((t) => t.outcome === 'missed').length,
    early_responses: session.trials.filter((t) => t.outcome === 'early').length,
    median_reaction_time_ms: median === null ? null : round3(median),
    p90_reaction_time_ms: p90 === null ? null : round3(p90),
  };
}

/** A completed session with at least `minimum_valid_trials` valid responses. */
export function usable(session: Session): boolean {
  return (
    session.completion === 'completed' &&
    sessionSummary(session).valid_trials >= DEMO_POLICY.minimum_valid_trials
  );
}
