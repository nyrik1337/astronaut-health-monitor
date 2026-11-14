import { describe, expect, test } from 'vitest';
import { INITIAL_RT, RT, classifyResponse, randomWaits, rtReducer, toSession, type RtState } from './rtEngine';

/** orbita-rt-1 protocol rules on the pure engine, driven frame by frame with injected time. */

const UTC = '2026-11-14T10:00:00.000Z';
const WAITS = Array.from({ length: RT.TRIALS }, () => 1000);
const FRAME = 16;

interface Clock {
  state: RtState;
  now: number;
}

const start = (): Clock => ({ state: rtReducer(INITIAL_RT, { type: 'start', now: 0, utc: UTC, waits: WAITS }), now: 0 });

/** Advances whole frames until `done` holds (or a safety limit). */
function advance(c: Clock, done: (s: RtState) => boolean): Clock {
  let { state, now } = c;
  for (let i = 0; i < 1000 && !done(state); i++) {
    now += FRAME;
    state = rtReducer(state, { type: 'frame', now, utc: UTC });
  }
  return { state, now };
}

/** Frames up to `until` (inclusive of the last frame before it). */
function framesUntil(c: Clock, until: number): Clock {
  let { state, now } = c;
  while (now + FRAME <= until) {
    now += FRAME;
    state = rtReducer(state, { type: 'frame', now, utc: UTC });
  }
  return { state, now };
}

const press = (c: Clock, at: number, repeat = false): Clock => ({
  state: rtReducer(c.state, { type: 'keydown', now: at, utc: UTC, repeat }),
  now: at,
});
const release = (c: Clock): Clock => ({ state: rtReducer(c.state, { type: 'keyup' }), now: c.now });

/** Waits for the target, responds `rt` ms after onset and releases the key. */
function respond(c: Clock, rt: number): Clock {
  const shown = advance(c, (s) => s.phase === 'target' || s.phase === 'finished');
  const onset = shown.state.onset ?? shown.now;
  return release(press(framesUntil(shown, onset + rt), onset + rt));
}

const toTrials = (c: Clock) => advance(c, (s) => s.phase === 'waiting' || s.phase === 'finished');

describe('orbita-rt-1 engine', () => {
  test('classifies early, valid and missed responses with the deadline winning', () => {
    expect(classifyResponse(99.9).outcome).toBe('early');
    expect(classifyResponse(100)).toEqual({ outcome: 'response', reaction_time_ms: 100 });
    expect(classifyResponse(1500)).toEqual({ outcome: 'response', reaction_time_ms: 1500 });
    expect(classifyResponse(1500.1).outcome).toBe('missed');
  });

  test('random waits are 20 integers in [1000, 3000]', () => {
    expect(randomWaits(() => 0)).toEqual(Array(20).fill(1000));
    const waits = randomWaits(() => 0.9999999);
    expect(waits).toHaveLength(20);
    expect(waits.every((w) => Number.isInteger(w) && w >= 1000 && w <= 3000)).toBe(true);
  });

  test('a complete attempt has 20 reconciled trials and no interruptions', () => {
    let c = toTrials(start());
    for (let i = 0; i < RT.TRIALS; i++) c = toTrials(respond(c, 300));
    expect(c.state.phase).toBe('finished');
    expect(c.state.completion).toBe('completed');
    expect(c.state.trials).toHaveLength(20);
    expect(c.state.trials.every((t) => t.outcome === 'response' && t.reaction_time_ms === 300)).toBe(true);
    const session = toSession(c.state, {
      session_id: 's1', subject_id: 'p1', clock: { kind: 'utc', id: 'utc' }, phase: 'measurement',
      source: { kind: 'browser_measured', source_id: null },
      context: { setup_id: 'x', device_class: 'laptop', browser_family: 'chrome', browser_version: '1', os_family: 'macos', os_version: '1', input_method: 'keyboard_space', timing_api: 'performance_now' },
    });
    expect(session?.interruptions).toEqual([]);
    expect(session?.trials.map((t) => t.index)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  test('a press before onset is early, no response is missed, key repeats are ignored', () => {
    const waiting = toTrials(start());
    const early = press(press(waiting, waiting.now + 5), waiting.now + 6, true);
    expect(early.state.trials).toEqual([{ index: 1, wait_ms: 1000, outcome: 'early', reaction_time_ms: null }]);
    const missed = advance(waiting, (s) => s.trials.length === 1);
    expect(missed.state.trials[0]?.outcome).toBe('missed');
  });

  test('aborts on a held key, a scheduler gap, lost visibility or cancel — keeping only completed trials', () => {
    const waiting = toTrials(start());
    const shown = advance(waiting, (s) => s.phase === 'target');
    const held = toTrials(press(framesUntil(shown, (shown.state.onset ?? 0) + 300), (shown.state.onset ?? 0) + 300));
    expect(held.state.completion).toBe('aborted');
    expect(held.state.interruptions).toEqual(['held_key']);
    expect(held.state.trials).toHaveLength(1);

    const gap = rtReducer(waiting.state, { type: 'frame', now: waiting.now + 300, utc: UTC });
    expect(gap.interruptions).toEqual(['scheduler_gap']);
    const hidden = rtReducer(waiting.state, { type: 'interrupt', code: 'visibility_lost', utc: UTC });
    expect(hidden.interruptions).toEqual(['visibility_lost']);
    expect(hidden.trials).toEqual([]);
    expect(rtReducer(hidden, { type: 'interrupt', code: 'cancelled', utc: UTC })).toEqual(hidden);
  });
});
