/**
 * Playback clock for the synthetic mission replay. Pure state transitions, so playback is
 * deterministic and testable: the clock only chooses which day to show; what happens on that
 * day comes from the precomputed mission.
 */
import { clampDay } from '../mission/guards';
import { MISSION_DAYS } from '../mission/types';

export const SPEEDS = [1, 4, 16] as const;
export type Speed = (typeof SPEEDS)[number];

/** At 1× the 500-day mission plays in 120 seconds. */
export const BASE_DAYS_PER_SECOND = MISSION_DAYS / 120;
/** The clock advances in fixed steps, so the same actions always give the same days. */
export const TICK_MS = 100;

export interface PlaybackState {
  /** fractional day, 1 ≤ position ≤ MISSION_DAYS */
  readonly position: number;
  readonly playing: boolean;
  readonly speed: Speed;
}

export type PlaybackAction =
  | { readonly type: 'tick'; readonly elapsedMs: number }
  | { readonly type: 'play' }
  | { readonly type: 'pause' }
  | { readonly type: 'reset' }
  | { readonly type: 'seek'; readonly day: number }
  | { readonly type: 'speed'; readonly speed: Speed };

export const INITIAL_PLAYBACK: PlaybackState = { position: 1, playing: false, speed: 1 };

export const isSpeed = (value: number): value is Speed =>
  (SPEEDS as readonly number[]).includes(value);

export const currentDay = (state: PlaybackState): number => Math.floor(state.position);

export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case 'tick': {
      if (!state.playing) return state;
      const days = (action.elapsedMs / 1000) * BASE_DAYS_PER_SECOND * state.speed;
      const position = Math.min(MISSION_DAYS, state.position + days);
      return { ...state, position, playing: position < MISSION_DAYS };
    }
    case 'play':
      // Playing from the last day starts the replay again from day 1.
      return state.position >= MISSION_DAYS
        ? { ...state, position: 1, playing: true }
        : { ...state, playing: true };
    case 'pause':
      return { ...state, playing: false };
    case 'reset':
      return { ...INITIAL_PLAYBACK, speed: state.speed };
    case 'seek': {
      const position = clampDay(action.day, MISSION_DAYS);
      return { ...state, position, playing: state.playing && position < MISSION_DAYS };
    }
    case 'speed':
      return { ...state, speed: action.speed };
  }
}
