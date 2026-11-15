/**
 * Display text for the mission view. Wording follows the simulation's rules: descriptive,
 * non-diagnostic, no instructions, and synthetic data is always named as such.
 */
import { GROUPING_HOLD_DAYS } from '../mission/closedLoop';
import type { TFn } from '../i18n';
import type { AlertView, CellState, CrewId, DetectionView, ScenarioId } from '../mission/types';

export const REPLAY_NOTICE =
  'Synthetic replay: four simulated crew members generated in this browser from seed 2026. ' +
  'Experimental detection rules, not clinically validated and not a diagnosis. ' +
  'This view does not send data to the backend.';

/** Short cell labels; every cell also carries the full label for screen readers. */
export const SHORT_STATE: Record<CellState, string> = {
  within_baseline: 'Within baseline',
  short_term_deviation: 'Short-term',
  sustained_deviation: 'Sustained',
  multiple_signals: 'Multiple signals',
  requires_human_review: 'Human review',
  baseline_building: 'Building baseline',
  no_data: 'No data',
};

export const SCENARIO_LABELS: Record<ScenarioId, string> = {
  'sleep-drift-b': 'Slow sleep drift, crew member B',
  'module-co2': 'Simultaneous sleep shift with a CO₂ rise',
  'hr-artifact': 'Single heart-rate spike (sensor artefact)',
  'solar-storm': 'Simulated particle event',
  'return-to-range-c': 'Sleep dip and return to range, crew member C',
};

export const crewLabel = (crew: CrewId): string => `Crew member ${crew}`;

export const detectionKindLabel = (d: DetectionView): string =>
  d.kind === 'drift' ? 'Sustained-trend detector fired' : 'Single out-of-range value';

export function detectionStatusText(d: DetectionView, notifiedDay: number | null): string {
  switch (d.status) {
    case 'pending_grouping_check':
      return `Pending: grouping check until day ${d.decisionDay}`;
    case 'queued':
      return 'Waiting: daily alert budget reached';
    case 'notified':
      return notifiedDay === null ? 'Notified' : `Notified on day ${notifiedDay}`;
    case 'grouped':
      return 'Grouped into one multiple-signals item';
    case 'merged_into_open_alert':
      return 'Added to an open notification for the same measurement';
    case 'covered_by_environmental_event':
      return 'Covered by the simulated particle event';
  }
}

const days = (n: number): string => (n === 1 ? '1 day' : `${n} days`);

/** Why a notification came later than its detection, or null when it did not. */
export function delayText(alert: AlertView): string | null {
  const delay = alert.day - alert.detectedDay;
  if (delay <= 0) return null;
  const hold = alert.kind === 'drift' ? Math.min(delay, GROUPING_HOLD_DAYS) : 0;
  const budget = delay - hold;
  const parts: string[] = [];
  if (hold > 0) parts.push(`held ${days(hold)} for a grouping check`);
  if (budget > 0) parts.push(`deferred ${days(budget)} by the alert budget`);
  return `Detected on day ${alert.detectedDay}; ${parts.join(', ')}.`;
}

/** Why a detected item is still waiting on the snapshot day. */
export function waitingText(alert: AlertView, day: number): string {
  const holdEnd = alert.detectedDay + (alert.kind === 'drift' ? GROUPING_HOLD_DAYS : 0);
  return day < holdEnd
    ? `Detected on day ${alert.detectedDay}; grouping check until day ${holdEnd}.`
    : `Detected on day ${alert.detectedDay}; waiting for the daily alert budget.`;
}

/* ---- Translated variants used by the components (the English maps above stay for tests/engine). ---- */

export const crewLabelT = (crew: CrewId, t: TFn): string => t('cg.member', { crew });

export const detectionKindLabelT = (d: DetectionView, t: TFn): string =>
  d.kind === 'drift' ? t('det.drift') : t('det.spike');

export function detectionStatusTextT(d: DetectionView, notifiedDay: number | null, t: TFn): string {
  switch (d.status) {
    case 'pending_grouping_check':
      return t('det.pending_grouping_check', { day: d.decisionDay });
    case 'notified':
      return notifiedDay === null ? t('det.notified') : t('det.notifiedOn', { day: notifiedDay });
    default:
      return t(`det.${d.status}`);
  }
}

export function delayTextT(alert: AlertView, t: TFn): string | null {
  const delay = alert.day - alert.detectedDay;
  if (delay <= 0) return null;
  const hold = alert.kind === 'drift' ? Math.min(delay, GROUPING_HOLD_DAYS) : 0;
  const budget = delay - hold;
  const parts: string[] = [];
  const dayCount = (n: number): string => t(n === 1 ? 'unit.day' : 'unit.days', { n });
  if (hold > 0) parts.push(t('delay.hold', { days: dayCount(hold) }));
  if (budget > 0) parts.push(t('delay.budget', { days: dayCount(budget) }));
  return `${t('delay.detected', { day: alert.detectedDay })} ${parts.join(', ')}.`;
}

export function waitingTextT(alert: AlertView, day: number, t: TFn): string {
  const holdEnd = alert.detectedDay + (alert.kind === 'drift' ? GROUPING_HOLD_DAYS : 0);
  return day < holdEnd
    ? t('wait.grouping', { day: alert.detectedDay, until: holdEnd })
    : t('wait.budget', { day: alert.detectedDay });
}

export const formatValue = (value: number | null, decimals: number): string =>
  value === null || !Number.isFinite(value) ? '—' : value.toFixed(decimals);

export const formatSigned = (value: number | null, decimals = 2): string =>
  value === null || !Number.isFinite(value)
    ? '—'
    : `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(decimals)}`;
