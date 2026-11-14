/**
 * SYNTHETIC MISSION SIMULATION — shared types and parameters.
 *
 * Everything in src/mission is generated in the browser for demonstration. The detection rules
 * (robust z-score, EWMA, CUSUM, signal categories, alert budget) are EXPERIMENTAL and NOT
 * clinically validated. They describe statistical deviation from a personal baseline; they do not
 * diagnose, predict or recommend treatment. Arrays "per day" have MISSION_DAYS entries; index 0 is
 * day 1.
 */

export const CREW_IDS = ['A', 'B', 'C', 'D'] as const;
export type CrewId = (typeof CREW_IDS)[number];

export const DOMAIN_IDS = ['cardio', 'musculo', 'behavior', 'sleep', 'immune', 'radiation'] as const;
export type DomainId = (typeof DOMAIN_IDS)[number];

export const MISSION_DAYS = 500;
/** Days 1–30 build the personal baseline. Nothing is evaluated during this period. */
export const BASELINE_DAYS = 30;
/** First evaluated day. The baseline is frozen from this day on. */
export const EVALUATION_START_DAY = BASELINE_DAYS + 1;
/** Fewer valid baseline values than this → no baseline, no evaluation (same rule as the API). */
export const MIN_BASELINE_SAMPLES = 5;
/** Seed used for the demonstration mission. */
export const DEMO_SEED = 2026;
/**
 * Illustrative reference for the cumulative dose of one simulated particle event, in mSv.
 * It is a SIMULATION PARAMETER chosen for the demo display, not a validated action threshold.
 */
export const ILLUSTRATIVE_EVENT_DOSE_REFERENCE_MSV = 250;

/** Detector parameters (unchanged from the SpaceKitty prototype). */
export const EWMA_LAMBDA = 0.2;
export const CUSUM_K = 0.5;
export const CUSUM_H = 5;
export const MAD_SCALE = 1.4826;

/**
 * Statistical detector score for one series on one day (no medical meaning):
 * 0 no deviation · 1 short-term (single |z| ≥ 3, or CUSUM without EWMA confirmation)
 * 2 sustained (CUSUM above h confirmed by EWMA) · 3 large sustained shift.
 */
export type DetectorScore = 0 | 1 | 2 | 3;

/** Descriptive signal categories. They are NOT a severity scale. */
export const SIGNAL_CATEGORIES = [
  'within_baseline',
  'short_term_deviation',
  'sustained_deviation',
  'multiple_signals',
  'requires_human_review',
] as const;
export type SignalCategory = (typeof SIGNAL_CATEGORIES)[number];

/** State of one grid cell: a signal category, or a reason there is no category. */
export type CellState = SignalCategory | 'baseline_building' | 'no_data';

/** Alert category: health-signal categories plus simulated environmental events, kept apart. */
export type AlertCategory = SignalCategory | 'environmental_event';

export type ScenarioId =
  | 'sleep-drift-b'
  | 'module-co2'
  | 'hr-artifact'
  | 'solar-storm'
  | 'return-to-range-c';

/** Scripted scenario: used by the generator and as ground truth for labelling only. */
export interface ScenarioEvent {
  id: ScenarioId;
  /** day of the marker on the timeline (40, 120, 210, 300, 380) */
  markerDay: number;
  startDay: number;
  endDay: number;
  crew: CrewId[];
  domain: DomainId;
}

export type CrewSeries = Record<CrewId, Record<DomainId, number[]>>;

export interface GeneratedMission {
  synthetic: true;
  seed: number;
  values: CrewSeries;
  env: { co2: number[]; noise: number[] };
  events: ScenarioEvent[];
}

/** Personal baseline from days 1–30: median and robust spread. */
export interface Baseline {
  median: number;
  mad: number;
  /** MAD × 1.4826 (with a small floor when MAD is zero) */
  sigma: number;
  /** personal range: median ± 2 sigma */
  lo: number;
  hi: number;
  /** number of valid values the baseline was built from */
  samples: number;
}

/** Analysis of one series. `null` means "not evaluated": baseline period or missing value. */
export interface SeriesAnalysis {
  baseline: Baseline | null;
  z: (number | null)[];
  ewma: (number | null)[];
  cusumHi: (number | null)[];
  cusumLo: (number | null)[];
  score: (DetectorScore | null)[];
}

export type AlertScope = 'personal' | 'group' | 'environment';
export type AlertKind = 'drift' | 'outlier' | 'group' | 'environmental_event';
/**
 * returned_to_range — a later check found the value back in the personal range (no causal claim)
 * flagged_for_review — follow-up checks still found the value outside the range
 * ended — the observation window or the environmental condition ended
 */
export type AlertOutcome = 'open' | 'returned_to_range' | 'flagged_for_review' | 'ended';

/** Alert over the whole mission. snapshotAt derives its state on a given day. */
export interface Alert {
  synthetic: true;
  id: string;
  /** day the detector fired */
  detectedDay: number;
  /** day the alert is shown (≥ detectedDay because of the alert budget) */
  day: number;
  /** null for group and environmental alerts */
  crew: CrewId | null;
  affected: CrewId[];
  domain: DomainId;
  /** category when shown; a flagged alert becomes requires_human_review from reviewFlaggedDay */
  category: AlertCategory;
  scope: AlertScope;
  kind: AlertKind;
  direction: 'up' | 'down';
  title: string;
  text: string;
  /** true when no scripted scenario explains the alert (ground-truth labelling) */
  falsePositive: boolean;
  scenarioId: ScenarioId | null;
  reviewFlaggedDay: number | null;
  closedDay: number | null;
  finalOutcome: AlertOutcome;
  /** text added on closing or flagging */
  followUpText: string | null;
}

/** What happened to a raw detection. Nothing is dropped silently. */
export type Disposition =
  | 'alert'
  | 'merged_into_open_alert'
  | 'grouped'
  | 'covered_by_environmental_event';

export interface DetectionRecord {
  id: string;
  crew: CrewId;
  domain: DomainId;
  kind: 'drift' | 'outlier';
  day: number;
  direction: 'up' | 'down';
  disposition: Disposition;
  /** alert that shows or covers this detection */
  alertId: string | null;
}

export interface Mission {
  synthetic: true;
  seed: number;
  generated: GeneratedMission;
  analysis: Record<CrewId, Record<DomainId, SeriesAnalysis>>;
  /** cell states: [day index][crew index][domain index] */
  grid: CellState[][][];
  /** all alerts, ascending by shown day */
  alerts: Alert[];
  /** every raw detection and what happened to it */
  detections: DetectionRecord[];
  /** simulated particle event detected on this day */
  environmentalEventDays: boolean[];
  /** daily dose, mSv (crew mean) */
  doseDaily: number[];
  /** at most this many non-environmental alerts per person per day are shown */
  budgetPerDay: number;
}

/** An alert as seen on the snapshot day. */
export interface AlertView extends Alert {
  outcome: AlertOutcome;
}

export interface PacketItem {
  alertId: string;
  category: AlertCategory;
  title: string;
}

export interface EarthPacket {
  day: number;
  /** size of the daily summary in KB (UTF-8 JSON length / 1024) */
  sizeKB: number;
  /** review order (see REVIEW_ORDER in signals.ts), not a severity order */
  items: PacketItem[];
}

/** State on one day: the only thing a UI needs from the simulation. */
export interface Snapshot {
  synthetic: true;
  day: number;
  /** [crew index][domain index] */
  grid: CellState[][];
  /** shown alerts, newest first */
  alerts: AlertView[];
  /** detected but deferred by the alert budget; still inspectable */
  queue: AlertView[];
  counters: { total: number; falseAlarms: number; deferred: number };
  environment: {
    particleEventActive: boolean;
    eventDoseMSv: number;
    totalDoseMSv: number;
    co2: number;
    noise: number;
  };
  packet: EarthPacket;
}

export interface SeriesView {
  synthetic: true;
  crew: CrewId;
  domain: DomainId;
  values: number[];
  ewma: (number | null)[];
  baseline: Baseline | null;
}

export interface MissionMeta {
  synthetic: true;
  seed: number;
  days: number;
  events: ScenarioEvent[];
  budgetPerDay: number;
  computeMs: number;
}

/** Message protocol of the pure simulation core (the Web Worker wrapper comes in phase 2). */
export type WorkerRequest =
  | { type: 'init'; seed: number }
  | { type: 'snapshot'; day: number }
  | { type: 'series'; crew: CrewId; domain: DomainId };

export type WorkerResponse =
  | { type: 'ready'; meta: MissionMeta }
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'series'; series: SeriesView }
  | { type: 'error'; message: string };
