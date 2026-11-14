/**
 * SYNTHETIC MISSION SIMULATION — from detector output to descriptive signal categories.
 *
 * Statistical detection (scoreAt) is kept separate from how a result is described
 * (categoryFromScore). Categories describe the shape of a deviation from a personal baseline;
 * they are not a severity scale, a diagnosis or a prediction. Simulated environmental events are
 * handled separately and never appear as a "highest level" of this list.
 */
import { CUSUM_H, EVALUATION_START_DAY, EWMA_LAMBDA } from './types';
import type { AlertCategory, CellState, DetectorScore, SignalCategory } from './types';

/** A single value with |z| at or above this is a short-term deviation. */
export const OUTLIER_Z = 3;
/** Stationary standard deviation of the EWMA: sqrt(λ / (2 − λ)). */
export const EWMA_SIGMA = Math.sqrt(EWMA_LAMBDA / (2 - EWMA_LAMBDA));
/** EWMA confirms a CUSUM signal when it leaves three of its own sigmas. */
export const EWMA_CONFIRM = 3 * EWMA_SIGMA;
/** Sustained shift this large (in personal sigmas) is routed to human review. */
export const EWMA_LARGE = 2.5;

/** Detector score for one day from z, EWMA and both CUSUM sums. */
export function scoreAt(z: number, ewmaValue: number, cusumHi: number, cusumLo: number): DetectorScore {
  const upConfirmed = cusumHi > CUSUM_H && ewmaValue > EWMA_CONFIRM;
  const downConfirmed = cusumLo > CUSUM_H && ewmaValue < -EWMA_CONFIRM;
  if (upConfirmed || downConfirmed) {
    return Math.abs(ewmaValue) >= EWMA_LARGE ? 3 : 2;
  }
  if (Math.abs(z) >= OUTLIER_Z || cusumHi > CUSUM_H || cusumLo > CUSUM_H) return 1;
  return 0;
}

export interface CellContext {
  /** follow-up checks found the value still outside the range */
  flaggedForReview: boolean;
  /** the value belongs to an open group of signals across crew members */
  inGroup: boolean;
}

/** Descriptive category for an evaluated day. */
export function categoryFromScore(score: DetectorScore, context: CellContext): SignalCategory {
  if (context.flaggedForReview || score === 3) return 'requires_human_review';
  if (context.inGroup && score >= 1) return 'multiple_signals';
  if (score === 2) return 'sustained_deviation';
  if (score === 1) return 'short_term_deviation';
  return 'within_baseline';
}

/** Cell state: baseline period and missing data are reported as such, never as a category. */
export function cellState(
  day: number,
  score: DetectorScore | null,
  context: CellContext,
): CellState {
  if (day < EVALUATION_START_DAY) return 'baseline_building';
  if (score === null) return 'no_data';
  return categoryFromScore(score, context);
}

/**
 * Order in which open items are listed for human review (daily summary, alert budget queue).
 * It is a work-queue order, not a severity ranking.
 */
export const REVIEW_ORDER: Record<AlertCategory, number> = {
  environmental_event: 0,
  requires_human_review: 1,
  multiple_signals: 2,
  sustained_deviation: 3,
  short_term_deviation: 4,
  within_baseline: 5,
};
