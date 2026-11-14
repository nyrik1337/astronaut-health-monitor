/**
 * SYNTHETIC MISSION SIMULATION — routing of raw detections (experimental).
 *
 * Decides for each detection whether it becomes a personal alert, joins a group of simultaneous
 * signals, or is covered by a simulated environmental event. Each rule only uses information
 * available by the detection's decision day (detection day + hold), so nothing is decided with
 * data from the future, and every routed detection stays inspectable.
 */
import { MISSION_DAYS } from './types';
import type { CrewId, DomainId, SeriesAnalysis } from './types';
import type { Candidate } from './detections';
import { envElevated } from './crewVsEnv';
import type { EnvZ, SignalGroup } from './crewVsEnv';
import { GROUPING_HOLD_DAYS } from './closedLoop';

/** Personal radiation detections are covered for this many days after an environmental event. */
export const ENV_COVER_AFTER_DAYS = 20;

export interface EventRun {
  start: number;
  end: number;
}

/** Consecutive environmental-event days as 1-based runs. */
export function eventRuns(days: readonly boolean[]): EventRun[] {
  const runs: EventRun[] = [];
  days.forEach((on, i) => {
    if (!on) return;
    const last = runs[runs.length - 1];
    if (last && last.end === i) last.end = i + 1;
    else runs.push({ start: i + 1, end: i + 1 });
  });
  return runs;
}

const holdOf = (c: Candidate): number => (c.kind === 'drift' ? GROUPING_HOLD_DAYS : 0);

/** Environmental alert id covering a personal radiation detection, or null. */
export function coveringEnvironmentalEvent(c: Candidate, runs: readonly EventRun[]): string | null {
  if (c.domain !== 'radiation') return null;
  const run = runs.find(
    (r) => c.day >= r.start - holdOf(c) && c.day <= r.end + ENV_COVER_AFTER_DAYS,
  );
  return run ? `environment-${run.start}` : null;
}

/** Group id that absorbs a detection (formed by its decision day and still open), or null. */
export function coveringGroup(
  c: Candidate,
  groups: readonly SignalGroup[],
  closeDays: ReadonlyMap<string, number | null>,
): string | null {
  const group = groups.find((g) => {
    if (g.memberIds.includes(c.id)) return true;
    if (g.domain !== c.domain || !g.affected.includes(c.crew)) return false;
    const close = closeDays.get(g.id) ?? null;
    return c.day >= g.day - holdOf(c) && (close === null || c.day < close);
  });
  return group ? group.id : null;
}

/**
 * First day after formation on which every affected member is evaluated below a sustained score
 * and no module reading is above baseline; null if that never happens.
 */
export function groupCloseDay(
  g: SignalGroup,
  analysis: Record<CrewId, Record<DomainId, SeriesAnalysis>>,
  envZ: EnvZ,
): number | null {
  for (let day = g.day + 1; day <= MISSION_DAYS; day++) {
    const calm = g.affected.every((crew) => {
      const score = analysis[crew][g.domain].score[day - 1];
      return score !== null && score !== undefined && score < 2;
    });
    if (calm && !envElevated(envZ, day)) return day;
  }
  return null;
}
