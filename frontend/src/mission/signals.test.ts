// Detector score and descriptive signal categories (migrated from the former tier tests).
import { describe, expect, it } from 'vitest';
import {
  EWMA_CONFIRM,
  EWMA_LARGE,
  EWMA_SIGMA,
  REVIEW_ORDER,
  categoryFromScore,
  cellState,
  scoreAt,
} from './signals';
import { EVALUATION_START_DAY, SIGNAL_CATEGORIES } from './types';

const none = { flaggedForReview: false, inGroup: false };

describe('scoreAt', () => {
  it('0 when nothing is out', () => {
    expect(scoreAt(0.4, 0.1, 0.5, 0)).toBe(0);
  });

  it('1 for a single |z| >= 3, both signs', () => {
    expect(scoreAt(3.2, 0.5, 2.5, 0)).toBe(1);
    expect(scoreAt(-3.2, -0.5, 0, 2.5)).toBe(1);
  });

  it('1 for CUSUM above h without EWMA confirmation', () => {
    expect(scoreAt(1, 0.4, 5.5, 0)).toBe(1);
  });

  it('2 for CUSUM above h with EWMA confirmation, either direction', () => {
    expect(scoreAt(1.5, EWMA_CONFIRM + 0.1, 6, 0)).toBe(2);
    expect(scoreAt(-1.5, -EWMA_CONFIRM - 0.1, 0, 6)).toBe(2);
  });

  it('does not confirm when EWMA has the opposite sign', () => {
    expect(scoreAt(0, -1.5, 6, 0)).toBe(1);
  });

  it('3 for a very large sustained shift', () => {
    expect(scoreAt(3, EWMA_LARGE + 0.1, 12, 0)).toBe(3);
  });

  it('EWMA sigma equals sqrt(0.2 / 1.8)', () => {
    expect(EWMA_SIGMA).toBeCloseTo(0.3333, 4);
    expect(EWMA_CONFIRM).toBeCloseTo(1, 4);
  });
});

describe('categoryFromScore', () => {
  it('maps detector scores to descriptive categories', () => {
    expect(categoryFromScore(0, none)).toBe('within_baseline');
    expect(categoryFromScore(1, none)).toBe('short_term_deviation');
    expect(categoryFromScore(2, none)).toBe('sustained_deviation');
    expect(categoryFromScore(3, none)).toBe('requires_human_review');
  });

  it('a review flag routes any score to human review', () => {
    expect(categoryFromScore(0, { flaggedForReview: true, inGroup: false })).toBe(
      'requires_human_review',
    );
    expect(categoryFromScore(2, { flaggedForReview: true, inGroup: true })).toBe(
      'requires_human_review',
    );
  });

  it('a deviating value inside an open group is shown as multiple signals', () => {
    const grouped = { flaggedForReview: false, inGroup: true };
    expect(categoryFromScore(1, grouped)).toBe('multiple_signals');
    expect(categoryFromScore(2, grouped)).toBe('multiple_signals');
    expect(categoryFromScore(0, grouped)).toBe('within_baseline');
  });
});

describe('cellState and review order', () => {
  it('reports the baseline period and missing data instead of a category', () => {
    expect(cellState(1, 3, none)).toBe('baseline_building');
    expect(cellState(EVALUATION_START_DAY - 1, 2, none)).toBe('baseline_building');
    expect(cellState(EVALUATION_START_DAY, null, none)).toBe('no_data');
    expect(cellState(EVALUATION_START_DAY, 2, none)).toBe('sustained_deviation');
  });

  it('keeps environmental events outside the health signal categories', () => {
    expect(SIGNAL_CATEGORIES).toEqual([
      'within_baseline',
      'short_term_deviation',
      'sustained_deviation',
      'multiple_signals',
      'requires_human_review',
    ]);
    expect((SIGNAL_CATEGORIES as readonly string[]).includes('environmental_event')).toBe(false);
    for (const category of SIGNAL_CATEGORIES) expect(REVIEW_ORDER[category]).toBeGreaterThan(0);
  });
});
