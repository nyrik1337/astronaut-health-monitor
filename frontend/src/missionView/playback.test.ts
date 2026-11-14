import { describe, expect, test } from 'vitest';
import { MISSION_DAYS } from '../mission/types';
import {
  BASE_DAYS_PER_SECOND,
  INITIAL_PLAYBACK,
  TICK_MS,
  currentDay,
  isSpeed,
  playbackReducer,
  type PlaybackAction,
  type PlaybackState,
} from './playback';

const run = (actions: readonly PlaybackAction[], start: PlaybackState = INITIAL_PLAYBACK) =>
  actions.reduce(playbackReducer, start);
const ticks = (n: number): PlaybackAction[] =>
  Array.from({ length: n }, () => ({ type: 'tick', elapsedMs: TICK_MS }));

describe('playback clock', () => {
  test('starts paused on day 1 and does not move while paused', () => {
    const state = run(ticks(50));
    expect(currentDay(state)).toBe(1);
    expect(state.playing).toBe(false);
  });

  test('plays the 500-day mission in about 120 seconds at 1×', () => {
    const oneSecond = run([{ type: 'play' }, ...ticks(10)]);
    expect(oneSecond.position).toBeCloseTo(1 + BASE_DAYS_PER_SECOND, 9);
    const full = run([{ type: 'play' }, ...ticks(1200)]);
    expect(currentDay(full)).toBe(MISSION_DAYS);
    expect(full.playing).toBe(false);
  });

  test('16× is sixteen times faster and stops on the last day', () => {
    const slow = run([{ type: 'play' }, ...ticks(10)]);
    const fast = run([{ type: 'speed', speed: 16 }, { type: 'play' }, ...ticks(10)]);
    expect(fast.position - 1).toBeCloseTo((slow.position - 1) * 16, 9);
    const end = run([{ type: 'speed', speed: 16 }, { type: 'play' }, ...ticks(200)]);
    expect(end.position).toBe(MISSION_DAYS);
    expect(end.playing).toBe(false);
  });

  test('pause keeps the day; play from the last day restarts at day 1', () => {
    const paused = run([{ type: 'play' }, ...ticks(30), { type: 'pause' }, ...ticks(30)]);
    expect(currentDay(paused)).toBe(currentDay(run([{ type: 'play' }, ...ticks(30)])));
    const restarted = run([{ type: 'seek', day: MISSION_DAYS }, { type: 'play' }]);
    expect(restarted.position).toBe(1);
    expect(restarted.playing).toBe(true);
  });

  test('reset returns to day 1 and pauses, keeping the chosen speed', () => {
    const state = run([
      { type: 'speed', speed: 4 },
      { type: 'play' },
      ...ticks(20),
      { type: 'reset' },
    ]);
    expect(state).toEqual({ position: 1, playing: false, speed: 4 });
  });

  test('seek clamps to whole mission days and is deterministic', () => {
    expect(currentDay(run([{ type: 'seek', day: 70.6 }]))).toBe(71);
    expect(currentDay(run([{ type: 'seek', day: -5 }]))).toBe(1);
    expect(currentDay(run([{ type: 'seek', day: 9999 }]))).toBe(MISSION_DAYS);
    expect(currentDay(run([{ type: 'seek', day: Number.NaN }]))).toBe(1);
    const actions: PlaybackAction[] = [
      { type: 'play' },
      ...ticks(77),
      { type: 'seek', day: 300 },
      ...ticks(5),
    ];
    expect(run(actions)).toEqual(run(actions));
  });

  test('accepts only the offered speeds', () => {
    expect([1, 4, 16].every(isSpeed)).toBe(true);
    expect(isSpeed(2)).toBe(false);
  });
});
