/**
 * SYNTHETIC MISSION SIMULATION — alerts and follow-up observation (experimental).
 *
 * Builds alerts from detections and follows each one forward in time: a drift is re-checked
 * 3 and 6 days after it is released; back in the personal range → returned_to_range (no causal
 * claim); still outside after both checks → flagged_for_review. Every check uses data up to the
 * check day only.
 */
import { CREW_IDS, MISSION_DAYS } from './types';
import type { Alert, CrewId, SeriesAnalysis } from './types';
import { median } from './detect';
import { finiteValues } from './guards';
import type { Candidate } from './detections';
import { GROUP_WINDOW_DAYS } from './crewVsEnv';
import type { SignalGroup } from './crewVsEnv';
import {
  environmentalEventEndedText,
  explainDrift,
  explainEnvironmentalEvent,
  explainGroup,
  explainOutlier,
  groupEndedText,
  observationEndedText,
  returnedText,
} from './explain';

export const CHECK_EVERY_DAYS = 3;
export const CHECKS_BEFORE_REVIEW = 2;
/** Back in range: |mean z| of the last RANGE_WINDOW_DAYS valid days is below this. */
export const IN_RANGE_Z = 1;
export const RANGE_WINDOW_DAYS = 3;
export const OUTLIER_OBSERVATION_DAYS = 3;
/**
 * A drift detection is released this many days after it fires. During the hold the simulation
 * waits for possible simultaneous detections in other crew members, so grouping never needs
 * data from a later day.
 */
export const GROUPING_HOLD_DAYS = GROUP_WINDOW_DAYS;

const blank = {
  synthetic: true,
  falsePositive: false,
  scenarioId: null,
  reviewFlaggedDay: null,
  closedDay: null,
  finalOutcome: 'open',
  followUpText: null,
} as const;

/** Mean z of the last RANGE_WINDOW_DAYS days up to `day` (1-based) is within ±IN_RANGE_Z. */
export function inRange(z: readonly (number | null)[], day: number): boolean {
  const window = finiteValues(z.slice(Math.max(0, day - RANGE_WINDOW_DAYS), day));
  if (window.length === 0) return false;
  return Math.abs(window.reduce((s, v) => s + v, 0) / window.length) < IN_RANGE_Z;
}

function driftAlert(c: Candidate, a: SeriesAnalysis, values: readonly number[]): Alert {
  if (a.baseline === null) throw new Error(`Drift ${c.id} has no baseline.`);
  const span = finiteValues(values.slice(c.startDay - 1, c.day));
  const delta = (span.length > 0 ? median(span) : a.baseline.median) - a.baseline.median;
  const days = Math.max(2, c.day - c.startDay + 1);
  const ex = explainDrift(c.crew, c.domain, days, c.direction, delta);
  const score = a.score[c.day - 1];
  return {
    ...blank,
    id: c.id,
    detectedDay: c.day,
    day: c.day + GROUPING_HOLD_DAYS,
    crew: c.crew,
    affected: [c.crew],
    domain: c.domain,
    category: score === 3 ? 'requires_human_review' : 'sustained_deviation',
    scope: 'personal',
    kind: 'drift',
    direction: c.direction,
    title: ex.title,
    text: ex.text,
  };
}

/** Follow-up checks after release; see the module comment. */
export function followDrift(alert: Alert, crew: CrewId, z: readonly (number | null)[]): Alert {
  for (let n = 1; n <= CHECKS_BEFORE_REVIEW; n++) {
    const check = alert.day + n * CHECK_EVERY_DAYS;
    if (check > MISSION_DAYS) return alert;
    if (inRange(z, check)) {
      return {
        ...alert,
        closedDay: check,
        finalOutcome: 'returned_to_range',
        followUpText: returnedText(crew, alert.domain, check),
      };
    }
  }
  const flagDay = alert.day + CHECKS_BEFORE_REVIEW * CHECK_EVERY_DAYS;
  const flagged: Alert = { ...alert, reviewFlaggedDay: flagDay, finalOutcome: 'flagged_for_review' };
  for (let day = flagDay + 1; day <= MISSION_DAYS; day++) {
    if (inRange(z, day)) {
      return {
        ...flagged,
        closedDay: day,
        finalOutcome: 'returned_to_range',
        followUpText: returnedText(crew, alert.domain, day),
      };
    }
  }
  return flagged;
}

function outlierAlert(c: Candidate, a: SeriesAnalysis, values: readonly number[]): Alert {
  if (a.baseline === null) throw new Error(`Outlier ${c.id} has no baseline.`);
  const ex = explainOutlier(c.crew, c.domain, values[c.day - 1] ?? Number.NaN, a.baseline);
  const checkDay = Math.min(MISSION_DAYS, c.day + OUTLIER_OBSERVATION_DAYS);
  const back = inRange(a.z, checkDay);
  return {
    ...blank,
    id: c.id,
    detectedDay: c.day,
    day: c.day,
    crew: c.crew,
    affected: [c.crew],
    domain: c.domain,
    category: 'short_term_deviation',
    scope: 'personal',
    kind: 'outlier',
    direction: c.direction,
    title: ex.title,
    text: ex.text,
    closedDay: checkDay,
    finalOutcome: back ? 'returned_to_range' : 'ended',
    followUpText: back ? returnedText(c.crew, c.domain, checkDay) : observationEndedText(checkDay),
  };
}

export interface PersonalResult {
  alerts: Alert[];
  /** drift detections that fired while an earlier alert of the same series was still open */
  merged: { candidate: Candidate; alertId: string }[];
}

/** Personal alerts of one series; a repeated drift while an alert is open joins that alert. */
export function buildPersonalAlerts(
  candidates: readonly Candidate[],
  a: SeriesAnalysis,
  values: readonly number[],
): PersonalResult {
  const alerts: Alert[] = [];
  const merged: PersonalResult['merged'] = [];
  let open: Alert | null = null;
  for (const c of [...candidates].sort((x, y) => x.day - y.day)) {
    if (c.kind === 'outlier') {
      alerts.push(outlierAlert(c, a, values));
      continue;
    }
    if (open && (open.closedDay === null || c.day < open.closedDay)) {
      merged.push({ candidate: c, alertId: open.id });
      continue;
    }
    open = followDrift(driftAlert(c, a, values), c.crew, a.z);
    alerts.push(open);
  }
  return { alerts, merged };
}

export function buildGroupAlert(group: SignalGroup, closedDay: number | null): Alert {
  const ex = explainGroup(group.domain, group.affected.length, CREW_IDS.length, GROUP_WINDOW_DAYS);
  return {
    ...blank,
    id: group.id,
    detectedDay: group.day,
    day: group.day,
    crew: null,
    affected: group.affected,
    domain: group.domain,
    category: 'multiple_signals',
    scope: 'group',
    kind: 'group',
    direction: group.direction,
    title: ex.title,
    text: ex.text,
    closedDay,
    finalOutcome: closedDay === null ? 'open' : 'returned_to_range',
    followUpText: closedDay === null ? null : groupEndedText(),
  };
}

export function buildEnvironmentalAlert(startDay: number, endDay: number): Alert {
  const ex = explainEnvironmentalEvent();
  const closedDay = endDay + 1 <= MISSION_DAYS ? endDay + 1 : null;
  return {
    ...blank,
    id: `environment-${startDay}`,
    detectedDay: startDay,
    day: startDay,
    crew: null,
    affected: [...CREW_IDS],
    domain: 'radiation',
    category: 'environmental_event',
    scope: 'environment',
    kind: 'environmental_event',
    direction: 'up',
    title: ex.title,
    text: ex.text,
    closedDay,
    finalOutcome: closedDay === null ? 'open' : 'ended',
    followUpText: closedDay === null ? null : environmentalEventEndedText(),
  };
}
