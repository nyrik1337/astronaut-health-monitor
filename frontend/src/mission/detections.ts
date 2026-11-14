/**
 * SYNTHETIC MISSION SIMULATION — raw detections for one series (experimental).
 *
 * Drift episodes (score ≥ 2 held for CONFIRM_DAYS) and single out-of-range values, plus detection
 * of a simulated particle event across all crew. Each decision uses data up to that day only.
 * The scripted scenario list is not visible here.
 */
import { BASELINE_DAYS, CREW_IDS } from './types';
import type { CrewId, DetectorScore, DomainId, SeriesAnalysis } from './types';
import { OUTLIER_Z } from './signals';

/** Drift episodes closer than this many days count as one episode. */
export const MERGE_GAP = 4;
/** A sustained score must hold this many consecutive days before a drift is reported. */
export const CONFIRM_DAYS = 3;
/** Simulated particle event: daily-dose z of every crew member at or above this value. */
export const ENV_EVENT_Z = 8;
const OUTLIER_QUIET_DAYS = 3;

export interface Candidate {
  /** stable id: kind-crew-domain-day */
  id: string;
  crew: CrewId;
  domain: DomainId;
  kind: 'drift' | 'outlier';
  /** day the detection fired (1-based) */
  day: number;
  direction: 'up' | 'down';
  /** estimated start of the shift, from where the CUSUM sum began to grow */
  startDay: number;
}

const sustained = (score: DetectorScore | null | undefined): boolean =>
  score !== null && score !== undefined && score >= 2;

/** Index ranges where the score stayed ≥ 2 for at least CONFIRM_DAYS days. */
function confirmedStreaks(
  score: readonly (DetectorScore | null)[],
): { start: number; end: number }[] {
  const streaks: { start: number; end: number }[] = [];
  let from = -1;
  for (let i = BASELINE_DAYS; i <= score.length; i++) {
    const on = i < score.length && sustained(score[i]);
    if (on && from < 0) from = i;
    if (!on && from >= 0) {
      if (i - from >= CONFIRM_DAYS) streaks.push({ start: from + CONFIRM_DAYS - 1, end: i - 1 });
      from = -1;
    }
  }
  return streaks;
}

function driftRuns(score: readonly (DetectorScore | null)[]): { start: number; end: number }[] {
  const runs: { start: number; end: number }[] = [];
  for (const streak of confirmedStreaks(score)) {
    const last = runs[runs.length - 1];
    if (last && streak.start - last.end <= MERGE_GAP) last.end = streak.end;
    else runs.push({ ...streak });
  }
  return runs;
}

/** Walk back while the CUSUM sum was still growing; stops at missing or zero values. */
function changeStart(sums: readonly (number | null)[], from: number): number {
  let j = from;
  while (j > 0) {
    const previous = sums[j - 1];
    if (previous === null || previous === undefined || previous <= 0) break;
    j--;
  }
  return j;
}

export function findCandidates(crew: CrewId, domain: DomainId, a: SeriesAnalysis): Candidate[] {
  const out: Candidate[] = [];
  const runs = driftRuns(a.score);
  for (const run of runs) {
    const e = a.ewma[run.start];
    const direction = e !== null && e !== undefined && e > 0 ? 'up' : 'down';
    const sums = direction === 'up' ? a.cusumHi : a.cusumLo;
    const day = run.start + 1;
    out.push({
      id: `drift-${crew}-${domain}-${day}`,
      crew,
      domain,
      kind: 'drift',
      day,
      direction,
      startDay: changeStart(sums, run.start) + 1,
    });
  }
  let lastOutlier = -OUTLIER_QUIET_DAYS - 1;
  for (let i = BASELINE_DAYS; i < a.z.length; i++) {
    const z = a.z[i];
    if (z === null || z === undefined || Math.abs(z) < OUTLIER_Z) continue;
    const previous = a.z[i - 1];
    const previousHigh =
      previous !== null && previous !== undefined && Math.abs(previous) >= OUTLIER_Z;
    const inRun = runs.some((r) => i >= r.start && i <= r.end);
    if (previousHigh || inRun || i - lastOutlier <= OUTLIER_QUIET_DAYS) continue;
    lastOutlier = i;
    out.push({
      id: `outlier-${crew}-${domain}-${i + 1}`,
      crew,
      domain,
      kind: 'outlier',
      day: i + 1,
      direction: z > 0 ? 'up' : 'down',
      startDay: i + 1,
    });
  }
  return out;
}

/** Days with a simulated particle event: daily dose far above baseline for every crew member. */
export function detectEnvironmentalEventDays(
  analysis: Record<CrewId, Record<DomainId, SeriesAnalysis>>,
): boolean[] {
  return analysis.A.radiation.z.map((_, i) =>
    CREW_IDS.every((c) => {
      const z = analysis[c].radiation.z[i];
      return z !== null && z !== undefined && z >= ENV_EVENT_Z;
    }),
  );
}
