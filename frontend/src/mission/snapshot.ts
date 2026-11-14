/**
 * SYNTHETIC MISSION SIMULATION — state of the mission on one day.
 *
 * A pure function of the mission and a day number: alerts as known on that day, the budget queue,
 * environmental readings and the daily summary for ground. Nothing after the snapshot day leaks
 * into it: future closes, flags and alerts stay hidden until their day.
 */
import { CREW_IDS, DOMAIN_IDS, MISSION_DAYS } from './types';
import type {
  Alert,
  AlertView,
  CrewId,
  DetectionRecord,
  DetectionStatus,
  DetectionView,
  DomainId,
  Mission,
  MissionMeta,
  SeriesView,
  Snapshot,
} from './types';
import { flaggedText } from './explain';
import { CHECK_EVERY_DAYS } from './closedLoop';
import { clampDay } from './guards';
import { REVIEW_ORDER } from './signals';

const BYTES_PER_KB = 1024;
const round = (v: number, decimals: number): number => {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};
const roundOrNull = (v: number | null | undefined, decimals: number): number | null =>
  v === null || v === undefined ? null : round(v, decimals);

function viewAt(a: Alert, day: number): AlertView {
  const closed = a.closedDay !== null && day >= a.closedDay;
  const flagged = a.reviewFlaggedDay !== null && day >= a.reviewFlaggedDay;
  let followUpText: string | null = null;
  if (closed) followUpText = a.followUpText;
  else if (flagged && a.crew && a.reviewFlaggedDay !== null) {
    const flagDay = a.reviewFlaggedDay;
    followUpText = flaggedText(a.crew, a.domain, [flagDay - CHECK_EVERY_DAYS, flagDay]);
  }
  return {
    ...a,
    category: flagged ? 'requires_human_review' : a.category,
    outcome: closed ? a.finalOutcome : flagged ? 'flagged_for_review' : 'open',
    followUpText,
  };
}

function environmentAt(m: Mission, day: number): Snapshot['environment'] {
  const idx = day - 1;
  let last = idx;
  while (last >= 0 && !m.environmentalEventDays[last]) last--;
  let eventDose = 0;
  if (last >= 0) {
    let first = last;
    while (first > 0 && m.environmentalEventDays[first - 1]) first--;
    for (let i = first; i <= last; i++) eventDose += m.doseDaily[i] ?? 0;
  }
  let total = 0;
  for (let i = 0; i <= idx; i++) total += m.doseDaily[i] ?? 0;
  return {
    particleEventActive: m.environmentalEventDays[idx] ?? false,
    eventDoseMSv: round(eventDose, 1),
    totalDoseMSv: round(total, 1),
    co2: m.generated.env.co2[idx] ?? Number.NaN,
    noise: m.generated.env.noise[idx] ?? Number.NaN,
  };
}

function packetAt(m: Mission, day: number, shown: readonly AlertView[]): Snapshot['packet'] {
  const idx = day - 1;
  const open = shown.filter((a) => a.outcome === 'open' || a.outcome === 'flagged_for_review');
  const series = CREW_IDS.flatMap((c) =>
    DOMAIN_IDS.map((d) => ({
      c,
      d,
      v: roundOrNull(m.generated.values[c][d][idx], 2),
      z: roundOrNull(m.analysis[c][d].z[idx], 1),
    })),
  );
  const summary = {
    synthetic: true,
    day,
    series,
    env: {
      co2: roundOrNull(m.generated.env.co2[idx], 2),
      noise: roundOrNull(m.generated.env.noise[idx], 1),
    },
    dose: roundOrNull(m.doseDaily[idx], 2),
    alerts: open.map((a) => ({ id: a.id, category: a.category, title: a.title })),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(summary)).length;
  const items = open
    .map((a) => ({ alertId: a.id, category: a.category, title: a.title }))
    .sort((a, b) => REVIEW_ORDER[a.category] - REVIEW_ORDER[b.category]);
  return { day, sizeKB: round(bytes / BYTES_PER_KB, 1), items };
}

/** Status of a detection on `day`: its routing is revealed only from its decision day on. */
function statusAt(d: DetectionRecord, day: number, shown: ReadonlySet<string>): DetectionStatus {
  if (day < d.decisionDay) return 'pending_grouping_check';
  if (d.disposition !== 'alert') return d.disposition;
  return d.alertId !== null && shown.has(d.alertId) ? 'notified' : 'queued';
}

function detectionsAt(m: Mission, day: number, shown: readonly AlertView[]): DetectionView[] {
  const shownIds = new Set(shown.map((a) => a.id));
  return m.detections
    .filter((d) => d.day <= day)
    .map((d) => ({ ...d, status: statusAt(d, day, shownIds) }))
    .sort((a, b) => b.day - a.day || a.id.localeCompare(b.id));
}

export function snapshotAt(mission: Mission, dayIn: number): Snapshot {
  const day = clampDay(dayIn, MISSION_DAYS);
  const detected = mission.alerts.filter((a) => a.detectedDay <= day);
  const alerts = detected
    .filter((a) => a.day <= day)
    .map((a) => viewAt(a, day))
    .sort((a, b) => b.day - a.day || b.detectedDay - a.detectedDay || a.id.localeCompare(b.id));
  const queue = detected.filter((a) => a.day > day).map((a) => viewAt(a, day));
  const grid = mission.grid[day - 1] ?? [];
  return {
    synthetic: true,
    day,
    grid: grid.map((row) => [...row]),
    alerts,
    queue,
    detections: detectionsAt(mission, day, alerts),
    counters: {
      total: alerts.length,
      falseAlarms: alerts.filter((a) => a.falsePositive).length,
      deferred: queue.length,
    },
    environment: environmentAt(mission, day),
    packet: packetAt(mission, day, alerts),
  };
}

export function seriesView(mission: Mission, crew: CrewId, domain: DomainId): SeriesView {
  const a = mission.analysis[crew][domain];
  return {
    synthetic: true,
    crew,
    domain,
    values: [...mission.generated.values[crew][domain]],
    ewma: [...a.ewma],
    baseline: a.baseline,
  };
}

export function missionMeta(mission: Mission, computeMs: number): MissionMeta {
  return {
    synthetic: true,
    seed: mission.seed,
    days: MISSION_DAYS,
    events: mission.generated.events,
    budgetPerDay: mission.budgetPerDay,
    computeMs,
  };
}
