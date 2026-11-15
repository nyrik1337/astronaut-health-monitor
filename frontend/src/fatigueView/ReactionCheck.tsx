import { useEffect, useRef } from 'react';
import { RT, isActive, type RtState } from '../cognitive/rtEngine';
import { useReactionTest } from '../cognitive/useReactionTest';
import { Rich, useT, type TFn } from '../i18n';

type Props = {
  phase: 'familiarization' | 'measurement';
  /** Reason the check cannot run on this device, or null when it can. */
  unsupported: string | null;
  /** Called once with the finished attempt (completed or aborted). */
  onFinished: (state: RtState) => void;
};

function stageText(state: RtState, t: TFn): string {
  switch (state.phase) {
    case 'countdown':
      return t('rc.starting', {
        seconds: Math.max(1, Math.ceil((RT.COUNTDOWN_MS - (performance.now() - state.phaseStart)) / 1000)),
      });
    case 'waiting':
    case 'iti':
      return t('rc.wait');
    case 'target':
      return t('rc.press');
    default:
      return '';
  }
}

/** Browser part of the experimental orbita-rt-1 check (real participants only). */
export function ReactionCheck({ phase, unsupported, onFinished }: Props) {
  const { t } = useT();
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
        <Rich text={t('rc.intro', { phase: t(`rc.phase.${phase}`) })} />
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
            <span className="reaction-check__text">{stageText(state, t)}</span>
          </div>
          <p className="numeric" aria-live="polite">
            {active ? t('rc.trial', { n: Math.min(state.trials.length + 1, RT.TRIALS), total: RT.TRIALS }) : ''}
          </p>
          <div className="button-row">
            {active ? (
              <button type="button" className="button" onMouseDown={(e) => e.preventDefault()} onClick={cancel}>
                {t('rc.cancel')}
              </button>
            ) : (
              <button type="button" className="button button--primary" onClick={begin}>
                {t('rc.start')}
              </button>
            )}
          </div>
          {state.phase === 'finished' && (
            <p className="muted">
              {state.completion === 'completed'
                ? t('rc.completed')
                : t('rc.stopped', { reasons: state.interruptions.join(', '), count: state.trials.length })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
