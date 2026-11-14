import { useEffect, useRef } from 'react';
import { RT, isActive, type RtState } from '../cognitive/rtEngine';
import { useReactionTest } from '../cognitive/useReactionTest';

type Props = {
  phase: 'familiarization' | 'measurement';
  /** Reason the check cannot run on this device, or null when it can. */
  unsupported: string | null;
  /** Called once with the finished attempt (completed or aborted). */
  onFinished: (state: RtState) => void;
};

function stageText(state: RtState): string {
  switch (state.phase) {
    case 'countdown':
      return `Starting in ${Math.max(1, Math.ceil((RT.COUNTDOWN_MS - (performance.now() - state.phaseStart)) / 1000))}…`;
    case 'waiting':
    case 'iti':
      return 'Wait…';
    case 'target':
      return 'Press Space';
    default:
      return '';
  }
}

/** Browser part of the experimental orbita-rt-1 check (real participants only). */
export function ReactionCheck({ phase, unsupported, onFinished }: Props) {
  const { state, start, cancel, reset } = useReactionTest();
  const area = useRef<HTMLDivElement>(null);
  const reported = useRef(false);
  const active = isActive(state);

  useEffect(() => {
    if (state.phase === 'finished' && !reported.current) {
      reported.current = true;
      onFinished(state);
    }
  }, [state, onFinished]);

  const begin = (): void => {
    reported.current = false;
    reset();
    start();
    // Keep focus off buttons so Space never activates one during the check.
    area.current?.focus();
  };

  return (
    <div className="reaction-check">
      <p>
        Experimental ORBITA reaction-time check (orbita-rt-1), not a clinically validated PVT or NASA test. 20 trials:
        after a short random wait a black square appears — press <kbd>Space</kbd> as soon as you see it. Do not press
        before it appears. Switching tabs or windows stops the check. This attempt is labelled{' '}
        <strong>{phase === 'familiarization' ? 'familiarization (practice)' : 'measurement'}</strong>.
      </p>
      {unsupported !== null ? (
        <p className="error-notice" role="note">
          {unsupported}
        </p>
      ) : (
        <>
          <div
            ref={area}
            tabIndex={-1}
            className="reaction-check__area"
            data-phase={state.phase}
            aria-live="off"
            data-testid="reaction-area"
          >
            {state.phase === 'target' && <span className="reaction-check__target" aria-hidden="true" />}
            <span className="reaction-check__text">{stageText(state)}</span>
          </div>
          <p className="numeric" aria-live="polite">
            {active ? `Trial ${Math.min(state.trials.length + 1, RT.TRIALS)} of ${RT.TRIALS}` : ''}
          </p>
          <div className="button-row">
            {active ? (
              <button type="button" className="button" onMouseDown={(e) => e.preventDefault()} onClick={cancel}>
                Cancel check
              </button>
            ) : (
              <button type="button" className="button button--primary" onClick={begin}>
                Start reaction-time check
              </button>
            )}
          </div>
          {state.phase === 'finished' && (
            <p className="muted">
              {state.completion === 'completed'
                ? 'Check completed: 20 trials recorded.'
                : `Check stopped (${state.interruptions.join(', ')}) after ${state.trials.length} trials. Only completed trials are kept; the attempt is sent as interrupted.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
