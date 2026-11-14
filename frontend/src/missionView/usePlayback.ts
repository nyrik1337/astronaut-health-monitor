/** React binding for the playback clock: a fixed-step interval runs only while playing. */
import { useCallback, useEffect, useReducer } from 'react';
import {
  INITIAL_PLAYBACK,
  TICK_MS,
  currentDay,
  playbackReducer,
  type Speed,
} from './playback';

export interface UsePlaybackResult {
  readonly day: number;
  readonly playing: boolean;
  readonly speed: Speed;
  readonly play: () => void;
  readonly pause: () => void;
  readonly reset: () => void;
  readonly seek: (day: number) => void;
  readonly setSpeed: (speed: Speed) => void;
}

export function usePlayback(): UsePlaybackResult {
  const [state, dispatch] = useReducer(playbackReducer, INITIAL_PLAYBACK);

  useEffect(() => {
    if (!state.playing) return undefined;
    const timer = setInterval(() => dispatch({ type: 'tick', elapsedMs: TICK_MS }), TICK_MS);
    return () => clearInterval(timer);
  }, [state.playing]);

  const play = useCallback(() => dispatch({ type: 'play' }), []);
  const pause = useCallback(() => dispatch({ type: 'pause' }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);
  const seek = useCallback((day: number) => dispatch({ type: 'seek', day }), []);
  const setSpeed = useCallback((speed: Speed) => dispatch({ type: 'speed', speed }), []);

  return {
    day: currentDay(state),
    playing: state.playing,
    speed: state.speed,
    play,
    pause,
    reset,
    seek,
    setSpeed,
  };
}
