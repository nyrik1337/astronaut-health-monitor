import { useEffect, useRef, useState } from 'react';
import { PRACTICE_DURATIONS_MS, isPracticeDuration, type PracticeDurationMs } from '../recovery/breathing';
import { useT, type TKey } from '../i18n';
import { useBreathingPractice, type PracticeStatus } from '../recovery/useBreathingPractice';

const PROMPTS = {
  inhale: 'br.inhale',
  exhale: 'br.exhale',
  done: 'br.done',
} as const satisfies Record<string, TKey>;

type Props = {
  onEnded: (status: Extract<PracticeStatus, 'stopped' | 'completed'>) => void;
  onRestart: () => void;
  now?: () => number;
};

/** Guided relaxed breathing: comfortable inhale and exhale prompts only, with pause and stop. */
export function BreathingPractice({ onEnded, onRestart, now }: Props) {
  const [duration, setDuration] = useState<PracticeDurationMs>(60_000);
  const { t } = useT();
  const practice = useBreathingPractice(duration, now);
  const { status, frame } = practice;
  const active = status === 'running' || status === 'paused';
  const ended = status === 'stopped' || status === 'completed';

  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  useEffect(() => {
    // Reported once per transition into an ended state.
    if (status === 'stopped' || status === 'completed') onEndedRef.current(status);
  }, [status]);

  const restart = (): void => {
    practice.reset();
    onRestart();
  };

  return (
    <div className="breathing" data-status={status}>
      <p className="breathing__safety">
        {t('br.safety')}
      </p>
      {status === 'idle' && (
        <div className="button-row">
          <div className="field">
            <label htmlFor="breathing-duration">{t('br.length')}</label>
            <select
              id="breathing-duration"
              value={duration}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (isPracticeDuration(next)) setDuration(next);
              }}
            >
              {PRACTICE_DURATIONS_MS.map((ms) => (
                <option key={ms} value={ms}>
                  {t('br.seconds', { seconds: ms / 1000 })}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="button button--primary" onClick={practice.start}>
            {t('br.start')}
          </button>
        </div>
      )}
      {status !== 'idle' && (
        <>
          <div className="breathing__guide" data-phase={frame.phase} aria-hidden="true">
            <div className="breathing__circle" />
          </div>
          <p className="breathing__prompt" aria-live="polite" data-testid="breathing-prompt">
            {status === 'paused' ? t('br.paused') : status === 'stopped' ? t('br.stopped') : t(PROMPTS[frame.phase])}
          </p>
          <p className="muted numeric" data-testid="breathing-remaining">
            {frame.phase === 'done'
              ? t('br.breaths', { count: frame.breaths })
              : t('br.remaining', { phase: frame.phaseSecondsLeft, total: frame.remainingSeconds })}
          </p>
        </>
      )}
      {active && (
        <div className="button-row">
          {status === 'running' ? (
            <button type="button" className="button" onClick={practice.pause}>
              {t('br.pause')}
            </button>
          ) : (
            <button type="button" className="button" onClick={practice.resume}>
              {t('br.resume')}
            </button>
          )}
          <button type="button" className="button" onClick={practice.stop}>
            {t('br.stop')}
          </button>
        </div>
      )}
      {ended && (
        <div className="button-row">
          <button type="button" className="button" onClick={restart}>
            {t('br.again')}
          </button>
        </div>
      )}
    </div>
  );
}
