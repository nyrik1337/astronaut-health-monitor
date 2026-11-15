import { describe, expect, test } from 'vitest';
import { CYCLE_MS, INHALE_MS, breathingFrame, isPracticeDuration } from './breathing';

describe('relaxed breathing pacing', () => {
  test('alternates only between a comfortable inhale and a longer exhale', () => {
    const phases = new Set<string>();
    for (let ms = 0; ms < 90_000; ms += 250) phases.add(breathingFrame(ms, 90_000).phase);
    expect([...phases].sort()).toEqual(['exhale', 'inhale']);
    expect(breathingFrame(0, 60_000)).toMatchObject({ phase: 'inhale', phaseSecondsLeft: 4, remainingSeconds: 60 });
    expect(breathingFrame(INHALE_MS, 60_000)).toMatchObject({ phase: 'exhale', phaseSecondsLeft: 6 });
    expect(breathingFrame(CYCLE_MS + 1, 60_000)).toMatchObject({ phase: 'inhale', breaths: 1 });
  });

  test('finishes exactly at the chosen length and never runs past it', () => {
    expect(breathingFrame(60_000, 60_000)).toEqual({ phase: 'done', phaseSecondsLeft: 0, remainingSeconds: 0, breaths: 6 });
    expect(breathingFrame(500_000, 90_000)).toMatchObject({ phase: 'done', breaths: 9 });
    expect(breathingFrame(-10, 60_000).phase).toBe('inhale');
  });

  test('only 60 and 90 second practices are allowed', () => {
    expect(isPracticeDuration(60_000)).toBe(true);
    expect(isPracticeDuration(90_000)).toBe(true);
    expect(isPracticeDuration(30_000)).toBe(false);
    expect(isPracticeDuration(120_000)).toBe(false);
  });
});
