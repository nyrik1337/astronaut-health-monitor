import { useCallback, useEffect, useReducer } from 'react';
import { INITIAL_RT, isActive, randomWaits, rtReducer, type RtState } from './rtEngine';

/**
 * Runs the orbita-rt-1 engine in the browser: a requestAnimationFrame loop drives frames (and
 * detects scheduler gaps), the Space key is read with performance.now(), and losing visibility
 * or focus aborts the attempt. Start/end instants come from the UTC wall clock only.
 */

const utcNow = (): string => new Date().toISOString();

export interface UseReactionTestResult {
  readonly state: RtState;
  readonly start: () => void;
  readonly cancel: () => void;
  readonly reset: () => void;
}

export function useReactionTest(rand: () => number = Math.random): UseReactionTestResult {
  const [state, dispatch] = useReducer(
    (s: RtState, e: Parameters<typeof rtReducer>[1] | { type: 'reset' }) =>
      e.type === 'reset' ? INITIAL_RT : rtReducer(s, e),
    INITIAL_RT,
  );
  const active = isActive(state);

  useEffect(() => {
    if (!active) return undefined;
    let frame = 0;
    const loop = (): void => {
      dispatch({ type: 'frame', now: performance.now(), utc: utcNow() });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      dispatch({ type: 'keydown', now: performance.now(), utc: utcNow(), repeat: event.repeat });
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'Space') dispatch({ type: 'keyup' });
    };
    const onVisibility = (): void => {
      if (document.visibilityState !== 'visible') dispatch({ type: 'interrupt', code: 'visibility_lost', utc: utcNow() });
    };
    const onBlur = (): void => dispatch({ type: 'interrupt', code: 'window_blur', utc: utcNow() });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [active]);

  const start = useCallback(() => {
    dispatch({ type: 'start', now: performance.now(), utc: utcNow(), waits: randomWaits(rand) });
  }, [rand]);
  const cancel = useCallback(() => dispatch({ type: 'interrupt', code: 'cancelled', utc: utcNow() }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  return { state, start, cancel, reset };
}
