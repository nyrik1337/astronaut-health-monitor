/**
 * SYNTHETIC MISSION SIMULATION — grouping of simultaneous signals (experimental).
 *
 * When the same domain drifts for ≥ 3 of 4 crew members within a few days and a module reading
 * (CO₂ or noise) is above its own baseline, the signals are grouped into one item. The grouping
 * describes co-occurrence only; it does not claim a cause. Each group is formed from data up to its
 * formation day.
 */
import { CREW_IDS } from './types';
import type { CrewId, DomainId, GeneratedMission } from './types';
import { evaluatedZ } from './detect';
import { finiteValues } from './guards';
import type { Candidate } from './detections';

export const GROUP_MIN_CREW = 3;
/** Drift starts within this many days of each other count as simultaneous. */
export const GROUP_WINDOW_DAYS = 3;
/** A module reading is above baseline when its robust z exceeds this. */
export const ENV_Z = 5;
const ENV_LOOKBACK = 6;

export interface SignalGroup {
  id: string;
  domain: DomainId;
  /** day the group is formed: the third crew member's detection */
  day: number;
  affected: CrewId[];
  direction: 'up' | 'down';
  /** ids of the drift detections that formed the group */
  memberIds: string[];
}

export interface EnvZ {
  co2: (number | null)[];
  noise: (number | null)[];
}

/** Module readings against their own days 1–30 baselines; null before day 31. */
export function envZScores(env: GeneratedMission['env']): EnvZ {
  return { co2: evaluatedZ(env.co2), noise: evaluatedZ(env.noise) };
}

/** A module reading was above baseline on some of the last ENV_LOOKBACK days up to `day`. */
export function envElevated(envZ: EnvZ, day: number): boolean {
  const from = Math.max(0, day - ENV_LOOKBACK);
  const above = (zs: readonly (number | null)[]): boolean =>
    finiteValues(zs.slice(from, day)).some((v) => v > ENV_Z);
  return above(envZ.co2) || above(envZ.noise);
}

/** Day on which the third distinct crew member was detected, or null. */
function formationDay(cluster: readonly Candidate[]): number | null {
  const firstByCrew = new Map<CrewId, number>();
  for (const c of cluster) if (!firstByCrew.has(c.crew)) firstByCrew.set(c.crew, c.day);
  const days = [...firstByCrew.values()].sort((a, b) => a - b);
  return days.length >= GROUP_MIN_CREW ? (days[GROUP_MIN_CREW - 1] ?? null) : null;
}

/** Groups from drift detections. */
export function findGroups(drifts: readonly Candidate[], envZ: EnvZ): SignalGroup[] {
  const sorted = [...drifts].sort((a, b) => a.day - b.day || a.id.localeCompare(b.id));
  const groups: SignalGroup[] = [];
  const used = new Set<string>();
  for (const anchor of sorted) {
    if (used.has(anchor.id) || anchor.kind !== 'drift') continue;
    const cluster = sorted.filter(
      (c) =>
        !used.has(c.id) &&
        c.kind === 'drift' &&
        c.domain === anchor.domain &&
        c.day >= anchor.day &&
        c.day <= anchor.day + GROUP_WINDOW_DAYS,
    );
    const day = formationDay(cluster);
    if (day === null || !envElevated(envZ, day)) continue;
    const members = cluster.filter((c) => c.day <= day);
    members.forEach((c) => used.add(c.id));
    const crew = new Set(members.map((c) => c.crew));
    groups.push({
      id: `group-${anchor.domain}-${day}`,
      domain: anchor.domain,
      day,
      direction: anchor.direction,
      affected: CREW_IDS.filter((c) => crew.has(c)),
      memberIds: members.map((c) => c.id),
    });
  }
  return groups;
}
