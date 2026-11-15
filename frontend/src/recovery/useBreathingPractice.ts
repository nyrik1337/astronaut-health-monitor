import { useCallback, useEffect, useRef, useState } from 'react';
import { breathingFrame, type BreathingFrame, type PracticeDurationMs } from './breathing';

export type PracticeStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'completed';

const TICK_MS = 250;

export interface BreathingPractice {
  readonly status: PracticeStatus;
  readonly frame: BreathingFrame;
  readonly start: () => void;
  readonly pause: () => void;
  readonly resume: () => void;
  readonly stop: () => void;
  readonly reset: () => void;
}

/**
 * Runs a relaxed-breathing practice in memory. Elapsed time only advances while running; the
 * practice pauses itself when the page is hidden so a prompt is never missed silently.
 */
export function useBreathingPractice(durationMs: PracticeDurationMs, now: () => number = () => Date.now()): BreathingPractice {
  const [status, setStatus] = useState<PracticeStatus>('idle');
  const [elapsed, setElapsed] = useState(0);
  const accumulated = useRef(0);
  const runningSince = useRef<number | null>(null);

  const settle = useCallback((): number => {
    const since = runningSince.current;
    if (since !== null) accumulated.current += now() - since;
    runningSince.current = null;
    return accumulated.current;
  }, [now]);

  const start = useCallback(() => {
    accumulated.current = 0;
    runningSince.current = now();
    setElapsed(0);
    setStatus('running');
  }, [now]);
  const pause = useCallback(() => {
    setElapsed(settle());
    setStatus((s) => (s === 'running' ? 'paused' : s));
  }, [settle]);
  const resume = useCallback(() => {
    runningSince.current = now();
    setStatus('running');
  }, [now]);
  const stop = useCallback(() => {
    setElapsed(settle());
    setStatus('stopped');
  }, [settle]);
  const reset = useCallback(() => {
    accumulated.current = 0;
    runningSince.current = null;
    setElapsed(0);
    setStatus('idle');
  }, []);

  useEffect(() => {
    if (status !== 'running') return undefined;
    const tick = (): void => {
      const since = runningSince.current ?? now();
      const total = accumulated.current + (now() - since);
      if (total >= durationMs) {
        accumulated.current = durationMs;
        runningSince.current = null;
        setElapsed(durationMs);
        setStatus('completed');
        return;
      }
      setElapsed(total);
    };
    const id = window.setInterval(tick, TICK_MS);
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [status, durationMs, now, pause]);

  return { status, frame: breathingFrame(elapsed, durationMs), start, pause, resume, stop, reset };
}
