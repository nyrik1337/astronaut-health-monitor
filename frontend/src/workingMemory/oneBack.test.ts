import { describe, expect, test } from 'vitest';
import {
  PRACTICE,
  SCORED,
  SYMBOLS,
  generateSequence,
  isMatch,
  oneBackReducer,
  scoreRun,
  startRun,
  type OneBackRun,
} from './oneBack';
import { seeded } from './testRng';

const matchCount = (sequence: readonly number[]): number =>
  sequence.reduce((n, _, i) => n + (isMatch(sequence, i) ? 1 : 0), 0);

describe('1-back sequence', () => {
  test('always has a lead-in plus exactly the requested matches and non-matches', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const scored = generateSequence(SCORED, seeded(seed));
      expect(scored).toHaveLength(SCORED.scoredTrials + 1);
      expect(matchCount(scored)).toBe(SCORED.matches);
      expect(scored.every((s) => s >= 0 && s < SYMBOLS.length)).toBe(true);
      const practice = generateSequence(PRACTICE, seeded(seed));
      expect(matchCount(practice)).toBe(PRACTICE.matches);
    }
  });

  test('match positions vary between runs', () => {
    const positions = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const s = generateSequence(SCORED, seeded(seed));
      positions.add(s.map((_, i) => (isMatch(s, i) ? 'M' : '-')).join(''));
    }
    expect(positions.size).toBeGreaterThan(10);
  });

  test('rejects impossible specifications', () => {
    expect(() => generateSequence({ scoredTrials: 3, matches: 4 }, seeded(1))).toThrow(RangeError);
  });
});

describe('1-back scoring', () => {
  // lead-in A, then A(match) B C C(match) A
  const sequence = [0, 0, 1, 2, 2, 0];

  test('counts hits, misses, false alarms and correct rejections, ignoring the lead-in', () => {
    const responded = [true, true, true, false, false, false];
    expect(scoreRun(sequence, responded)).toEqual({
      scoredTrials: 5,
      matchTrials: 2,
      hits: 1,
      misses: 1,
      falseAlarms: 1,
      correctRejections: 2,
      correct: 3,
      accuracy: 0.6,
    });
  });

  test('perfect and empty response patterns', () => {
    expect(scoreRun(sequence, sequence.map((_, i) => isMatch(sequence, i))).accuracy).toBe(1);
    expect(scoreRun(sequence, [])).toMatchObject({ hits: 0, misses: 2, falseAlarms: 0, correct: 3 });
  });
});

describe('1-back run reducer', () => {
  const fresh = (): OneBackRun => startRun('practice', seeded(7));

  test('the lead-in ignores presses and each symbol accepts one response', () => {
    let run = oneBackReducer(fresh(), { type: 'respond' });
    expect(run.responded.every((r) => !r)).toBe(true);
    run = oneBackReducer(run, { type: 'advance' });
    const once = oneBackReducer(run, { type: 'respond' });
    expect(oneBackReducer(once, { type: 'respond' })).toBe(once);
    expect(once.responded[1]).toBe(true);
  });

  test('completes after the last symbol; stopped or invalidated runs are frozen', () => {
    let run = fresh();
    for (let i = 0; i < run.sequence.length; i++) run = oneBackReducer(run, { type: 'advance' });
    expect(run.status).toBe('completed');

    const invalid = oneBackReducer(fresh(), { type: 'invalidate' });
    expect(invalid.status).toBe('invalidated');
    expect(oneBackReducer(invalid, { type: 'advance' })).toBe(invalid);
    expect(oneBackReducer(oneBackReducer(fresh(), { type: 'stop' }), { type: 'respond' }).status).toBe('stopped');
  });
});
