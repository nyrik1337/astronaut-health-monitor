import { useEffect, useRef, useState } from 'react';
import { PRACTICE_DURATIONS_MS, isPracticeDuration, type PracticeDurationMs } from '../recovery/breathing';
import { useBreathingPractice, type PracticeStatus } from '../recovery/useBreathingPractice';

const PROMPTS = {
  inhale: 'Breathe in gently through your nose',
  exhale: 'Breathe out slowly and softly',
  done: 'Practice finished — breathe normally',
} as const;

type Props = {
  onEnded: (status: Extract<PracticeStatus, 'stopped' | 'completed'>) => void;
  onRestart: () => void;
  now?: () => number;
};

/** Guided relaxed breathing: comfortable inhale and exhale prompts only, with pause and stop. */
export function BreathingPractice({ onEnded, onRestart, now }: Props) {
  const [duration, setDuration] = useState<PracticeDurationMs>(60_000);
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
        Breathe at a pace that feels comfortable. This practice has no breath-holding and no fast breathing. If you
        feel dizzy or uncomfortable, stop and breathe normally.
      </p>
      {status === 'idle' && (
        <div className="button-row">
          <div className="field">
            <label htmlFor="breathing-duration">Length</label>
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
                  {ms / 1000} seconds
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="button button--primary" onClick={practice.start}>
            Start breathing practice
          </button>
        </div>
      )}
      {status !== 'idle' && (
        <>
          <div className="breathing__guide" data-phase={frame.phase} aria-hidden="true">
            <div className="breathing__circle" />
          </div>
          <p className="breathing__prompt" aria-live="polite" data-testid="breathing-prompt">
            {status === 'paused' ? 'Paused' : status === 'stopped' ? 'Practice stopped — breathe normally' : PROMPTS[frame.phase]}
          </p>
          <p className="muted numeric" data-testid="breathing-remaining">
            {frame.phase === 'done' ? `${frame.breaths} breaths` : `${frame.phaseSecondsLeft} s · ${frame.remainingSeconds} s left`}
          </p>
        </>
      )}
      {active && (
        <div className="button-row">
          {status === 'running' ? (
            <button type="button" className="button" onClick={practice.pause}>
              Pause
            </button>
          ) : (
            <button type="button" className="button" onClick={practice.resume}>
              Resume
            </button>
          )}
          <button type="button" className="button" onClick={practice.stop}>
            Stop
          </button>
        </div>
      )}
      {ended && (
        <div className="button-row">
          <button type="button" className="button" onClick={restart}>
            Practice again
          </button>
        </div>
      )}
    </div>
  );
}
