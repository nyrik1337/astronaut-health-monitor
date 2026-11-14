import type { Interruption, Session, Trial } from './types';

/**
 * orbita-rt-1 reaction check as a pure state machine (docs/API_CONTRACT.md, "Fixed experimental
 * protocol"). Experimental ORBITA check — not a clinically validated PVT, NASA PVT+ or ISS test.
 * Time is injected: `now` is performance.now() (monotonic, used for every reaction time) and
 * `utc` is the wall-clock instant used only for the session's start/end timestamps.
 */

export const RT = {
  TRIALS: 20,
  WAIT_MIN_MS: 1000,
  WAIT_MAX_MS: 3000,
  EARLY_BELOW_MS: 100,
  DEADLINE_MS: 1500,
  ITI_MS: 500,
  COUNTDOWN_MS: 3000,
  MAX_FRAME_GAP_MS: 250,
} as const;

export type RtPhase = 'idle' | 'countdown' | 'waiting' | 'target' | 'iti' | 'finished';

export interface RtState {
  readonly phase: RtPhase;
  readonly waits: readonly number[];
  readonly trials: readonly Trial[];
  readonly phaseStart: number;
  readonly onset: number | null;
  readonly keyHeld: boolean;
  readonly lastFrame: number | null;
  readonly interruptions: readonly Interruption[];
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly completion: 'completed' | 'aborted' | null;
}

export type RtEvent =
  | { readonly type: 'start'; readonly now: number; readonly utc: string; readonly waits: readonly number[] }
  | { readonly type: 'frame'; readonly now: number; readonly utc: string }
  | { readonly type: 'keydown'; readonly now: number; readonly utc: string; readonly repeat: boolean }
  | { readonly type: 'keyup' }
  | { readonly type: 'interrupt'; readonly code: Interruption; readonly utc: string };

export const INITIAL_RT: RtState = {
  phase: 'idle',
  waits: [],
  trials: [],
  phaseStart: 0,
  onset: null,
  keyHeld: false,
  lastFrame: null,
  interruptions: [],
  startedAt: null,
  endedAt: null,
  completion: null,
};

/** 20 independent integer waits in [1000, 3000] ms. */
export function randomWaits(rand: () => number): number[] {
  const span = RT.WAIT_MAX_MS - RT.WAIT_MIN_MS + 1;
  return Array.from({ length: RT.TRIALS }, () => RT.WAIT_MIN_MS + Math.floor(rand() * span));
}

/** Outcome of a keydown `elapsed` ms after onset. The deadline wins over a late handler. */
export function classifyResponse(elapsed: number): { outcome: Trial['outcome']; reaction_time_ms: number | null } {
  if (elapsed > RT.DEADLINE_MS) return { outcome: 'missed', reaction_time_ms: null };
  if (elapsed < RT.EARLY_BELOW_MS) return { outcome: 'early', reaction_time_ms: null };
  return { outcome: 'response', reaction_time_ms: Math.round(elapsed * 1000) / 1000 };
}

export const isActive = (s: RtState): boolean =>
  s.phase === 'countdown' || s.phase === 'waiting' || s.phase === 'target' || s.phase === 'iti';

function finish(s: RtState, utc: string, interruption: Interruption | null): RtState {
  return {
    ...s,
    phase: 'finished',
    onset: null,
    endedAt: utc,
    completion: interruption === null ? 'completed' : 'aborted',
    interruptions: interruption === null ? s.interruptions : [...s.interruptions, interruption],
  };
}

function beginTrial(s: RtState, now: number, utc: string): RtState {
  // The key must be released before the next trial; a held key aborts the attempt.
  if (s.keyHeld) return finish(s, utc, 'held_key');
  return { ...s, phase: 'waiting', phaseStart: now, onset: null };
}

function record(s: RtState, result: ReturnType<typeof classifyResponse>, now: number, utc: string): RtState {
  const index = s.trials.length + 1;
  const trial: Trial = { index, wait_ms: s.waits[index - 1] ?? RT.WAIT_MIN_MS, ...result };
  const trials = [...s.trials, trial];
  const next = { ...s, trials, onset: null };
  if (trials.length === RT.TRIALS) return finish(next, utc, null);
  return { ...next, phase: 'iti', phaseStart: now };
}

function onFrame(s: RtState, now: number, utc: string): RtState {
  if (!isActive(s)) return s;
  if (s.lastFrame !== null && now - s.lastFrame > RT.MAX_FRAME_GAP_MS) {
    return finish({ ...s, lastFrame: now }, utc, 'scheduler_gap');
  }
  const t = { ...s, lastFrame: now };
  const since = now - t.phaseStart;
  switch (t.phase) {
    case 'countdown':
      return since >= RT.COUNTDOWN_MS ? beginTrial(t, now, utc) : t;
    case 'waiting':
      // The target is shown on this rendering frame; its software onset is `now`.
      return since >= (t.waits[t.trials.length] ?? RT.WAIT_MIN_MS) ? { ...t, phase: 'target', onset: now } : t;
    case 'target':
      return t.onset !== null && now - t.onset > RT.DEADLINE_MS
        ? record(t, { outcome: 'missed', reaction_time_ms: null }, now, utc)
        : t;
    case 'iti':
      return since >= RT.ITI_MS ? beginTrial(t, now, utc) : t;
    default:
      return t;
  }
}

export function rtReducer(s: RtState, e: RtEvent): RtState {
  switch (e.type) {
    case 'start':
      if (isActive(s)) return s;
      return {
        ...INITIAL_RT,
        keyHeld: s.keyHeld,
        phase: 'countdown',
        waits: e.waits,
        phaseStart: e.now,
        lastFrame: e.now,
        startedAt: e.utc,
      };
    case 'frame':
      return onFrame(s, e.now, e.utc);
    case 'keydown': {
      if (e.repeat) return s;
      const held = { ...s, keyHeld: true };
      if (s.phase === 'waiting') return record(held, { outcome: 'early', reaction_time_ms: null }, e.now, e.utc);
      if (s.phase === 'target' && s.onset !== null) return record(held, classifyResponse(e.now - s.onset), e.now, e.utc);
      return held;
    }
    case 'keyup':
      return { ...s, keyHeld: false };
    case 'interrupt':
      return isActive(s) ? finish(s, e.utc, e.code) : s;
  }
}

export interface SessionMeta {
  readonly session_id: string;
  readonly subject_id: string;
  readonly clock: Session['clock'];
  readonly phase: Session['phase'];
  readonly source: Session['source'];
  readonly context: Session['context'];
}

/** The finished attempt as a contract Session: only completed trials, never filled in. */
export function toSession(s: RtState, meta: SessionMeta): Session | null {
  if (s.phase !== 'finished' || s.startedAt === null || s.endedAt === null || s.completion === null) return null;
  return {
    ...meta,
    test_version: 'orbita-rt-1',
    started_at: s.startedAt,
    ended_at: s.endedAt,
    completion: s.completion,
    interruptions: s.interruptions,
    trials: s.trials,
  };
}
