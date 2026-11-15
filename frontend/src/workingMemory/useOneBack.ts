import { useCallback, useEffect, useState } from 'react';
import { SYMBOL_MS, TRIAL_MS, oneBackReducer, startRun, type OneBackEvent, type OneBackRun, type Rng, type Stage } from './oneBack';

export interface OneBack {
  readonly run: OneBackRun | null;
  /** False during the blank gap between symbols. */
  readonly symbolVisible: boolean;
  readonly start: (stage: Stage) => void;
  readonly respond: () => void;
  readonly stop: () => void;
  readonly reset: () => void;
}

const isEditable = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * Drives one 1-back run with plain timers. While running: Space (no key repeat) records a "match"
 * response, and losing the tab or window focus invalidates the run so it cannot look complete.
 */
export function useOneBack(rng: Rng = Math.random): OneBack {
  const [run, setRun] = useState<OneBackRun | null>(null);
  const [symbolVisible, setSymbolVisible] = useState(true);
  const dispatch = useCallback((event: OneBackEvent) => setRun((r) => (r === null ? r : oneBackReducer(r, event))), []);
  const running = run?.status === 'running';
  const index = run?.index ?? -1;

  useEffect(() => {
    if (!running) return undefined;
    setSymbolVisible(true);
    const hide = window.setTimeout(() => setSymbolVisible(false), SYMBOL_MS);
    const next = window.setTimeout(() => dispatch({ type: 'advance' }), TRIAL_MS);
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(next);
    };
  }, [running, index, dispatch]);

  useEffect(() => {
    if (!running) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.code !== 'Space' || isEditable(event.target)) return;
      event.preventDefault();
      if (!event.repeat) dispatch({ type: 'respond' });
    };
    const invalidate = (): void => dispatch({ type: 'invalidate' });
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') invalidate();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', invalidate);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', invalidate);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [running, dispatch]);

  const start = useCallback((stage: Stage) => setRun(startRun(stage, rng)), [rng]);
  const respond = useCallback(() => dispatch({ type: 'respond' }), [dispatch]);
  const stop = useCallback(() => dispatch({ type: 'stop' }), [dispatch]);
  const reset = useCallback(() => setRun(null), []);

  return { run, symbolVisible, start, respond, stop, reset };
}
