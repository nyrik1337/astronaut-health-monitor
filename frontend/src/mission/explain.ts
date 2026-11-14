/**
 * SYNTHETIC MISSION SIMULATION — user-facing labels and alert texts.
 *
 * Wording rules: factual and descriptive; no diagnosis, no treatment, exercise or behaviour
 * instructions; no causal claims. Every alert text names the data as synthetic and the detection
 * as experimental.
 */
import { ILLUSTRATIVE_EVENT_DOSE_REFERENCE_MSV } from './types';
import type { AlertCategory, AlertOutcome, Baseline, CellState, CrewId, DomainId } from './types';

export const SIMULATION_NOTICE =
  'Synthetic data; experimental detection rule, not clinically validated; not a diagnosis.';

export const domainLabels: Record<DomainId, string> = {
  cardio: 'Cardiovascular',
  musculo: 'Musculoskeletal',
  behavior: 'Behaviour and performance',
  sleep: 'Sleep',
  immune: 'Immune',
  radiation: 'Radiation exposure',
};

/** The metric that represents each domain in the simulation (all values synthetic). */
export const metricLabels: Record<DomainId, { label: string; unit: string; decimals: number }> = {
  cardio: { label: 'resting heart rate', unit: 'bpm', decimals: 0 },
  musculo: { label: 'load index', unit: 'a.u.', decimals: 0 },
  behavior: { label: 'reaction time', unit: 'ms', decimals: 0 },
  sleep: { label: 'sleep duration', unit: 'h', decimals: 1 },
  immune: { label: 'recovery index', unit: 'a.u.', decimals: 0 },
  radiation: { label: 'daily dose', unit: 'mSv', decimals: 2 },
};

export const stateLabels: Record<CellState | AlertCategory, string> = {
  within_baseline: 'Within baseline',
  short_term_deviation: 'Short-term deviation',
  sustained_deviation: 'Sustained deviation',
  multiple_signals: 'Multiple signals',
  requires_human_review: 'Requires human review',
  baseline_building: 'Baseline building (days 1–30)',
  no_data: 'No data',
  environmental_event: 'Simulated environmental event',
};

export const outcomeLabels: Record<AlertOutcome, string> = {
  open: 'Open',
  returned_to_range: 'Returned to range',
  flagged_for_review: 'Flagged for human review',
  ended: 'Ended',
};

export interface Explained {
  title: string;
  text: string;
}

const member = (crew: CrewId): string => `synthetic crew member ${crew}`;
const dayCount = (n: number): string => (n === 1 ? '1 day' : `${n} days`);
const format = (value: number, decimals: number): string => value.toFixed(decimals);

export function explainDrift(
  crew: CrewId,
  domain: DomainId,
  days: number,
  direction: 'up' | 'down',
  delta: number,
): Explained {
  const m = metricLabels[domain];
  const side = direction === 'down' ? 'below' : 'above';
  const size = format(Math.abs(delta), Math.max(1, m.decimals));
  return {
    title: `${domainLabels[domain]}: ${member(crew)}, sustained deviation`,
    text:
      `The ${m.label} of ${member(crew)} has been ${side} the personal baseline for ` +
      `${dayCount(days)} (median difference ${size} ${m.unit}). CUSUM signal confirmed by EWMA. ` +
      `The simulation re-checks it after 3 and 6 days. ${SIMULATION_NOTICE}`,
  };
}

export function explainOutlier(
  crew: CrewId,
  domain: DomainId,
  value: number,
  baseline: Baseline,
): Explained {
  const m = metricLabels[domain];
  return {
    title: `${domainLabels[domain]}: ${member(crew)}, short-term deviation`,
    text:
      `One ${m.label} value of ${member(crew)} was outside the personal range: ` +
      `${format(value, m.decimals)} ${m.unit} (range ${format(baseline.lo, m.decimals)}–` +
      `${format(baseline.hi, m.decimals)}). The previous day was within range. Single ` +
      `out-of-range values can also come from measurement artefacts. ${SIMULATION_NOTICE}`,
  };
}

export function explainGroup(
  domain: DomainId,
  affected: number,
  crewSize: number,
  windowDays: number,
): Explained {
  return {
    title: `${domainLabels[domain]}: multiple signals`,
    text:
      `The ${metricLabels[domain].label} shifted for ${affected} of ${crewSize} synthetic crew ` +
      `members within ${dayCount(windowDays)}, while a module reading (CO₂ or noise) was above its ` +
      `own baseline. The signals are grouped into one item. Co-occurrence alone does not establish ` +
      `a cause. ${SIMULATION_NOTICE}`,
  };
}

export function explainEnvironmentalEvent(): Explained {
  return {
    title: 'Simulated particle event',
    text:
      'Daily radiation dose rose sharply for all four synthetic crew members on the same day. ' +
      `The cumulative event dose is shown against an illustrative ` +
      `${ILLUSTRATIVE_EVENT_DOSE_REFERENCE_MSV} mSv simulation reference, which is not a ` +
      `validated action threshold. ${SIMULATION_NOTICE}`,
  };
}

export const returnedText = (crew: CrewId, domain: DomainId, day: number): string =>
  `Check on day ${day}: the ${metricLabels[domain].label} of ${member(crew)} is back within ` +
  `the personal range. This shows a return to range, not its cause.`;

export const flaggedText = (crew: CrewId, domain: DomainId, checkDays: number[]): string =>
  `Checks on days ${checkDays.join(' and ')}: the ${metricLabels[domain].label} of ` +
  `${member(crew)} remains outside the personal range. Flagged for human review.`;

export const observationEndedText = (day: number): string =>
  `Observation ended on day ${day}; the value was not yet back within range at that check.`;

export const groupEndedText = (): string =>
  'The affected synthetic crew members and the module reading are back within their baselines.';

export const environmentalEventEndedText = (): string =>
  'The simulated particle event is no longer detected in the daily dose readings.';
