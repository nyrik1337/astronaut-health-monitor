import { useState } from 'react';
import { BreathingPractice } from './BreathingPractice';
import { FollowUpCard } from './FollowUpCard';
import { STRESS_LABELS, StressCheckIn, type StressRating } from './StressCheckIn';
import './recovery.css';

type Ended = 'stopped' | 'completed';

const rated = (value: StressRating): string => `${value} / 5 (${STRESS_LABELS[value]})`;

/**
 * MindGuard Recovery Loop: voluntary stress self-report, a short relaxed-breathing practice and an
 * optional second self-report. Everything stays in this component's memory — nothing is stored in
 * the browser or sent to a server — and nothing here is a diagnosis or a treatment.
 */
export function RecoveryView({ now }: { now?: () => number }) {
  const [before, setBefore] = useState<StressRating | null>(null);
  const [after, setAfter] = useState<StressRating | null>(null);
  const [ended, setEnded] = useState<Ended | null>(null);
  const [run, setRun] = useState(0);

  const clear = (): void => {
    setBefore(null);
    setAfter(null);
    setEnded(null);
    setRun((n) => n + 1);
  };

  return (
    <div className="recovery">
      <div className="mission__intro">
        <h2 id="recovery-heading" className="mission__title">
          Stress check-in and breathing
        </h2>
        <p className="mission__notice">
          <strong>MindGuard</strong> is a voluntary wellbeing exercise, not a medical assessment or a treatment. Your
          answers stay in this page’s memory only: they are not stored in the browser or sent anywhere, and they are
          gone when you reload or clear them. If stress feels overwhelming, talk to your crew medical officer or a
          health professional.
        </p>
      </div>

      <section className="recovery-card" aria-labelledby="before-heading">
        <h3 id="before-heading" className="section-heading">
          1. Check in (optional)
        </h3>
        <StressCheckIn name="stress-before" legend="How stressed do you feel right now?" value={before} onChange={setBefore} />
      </section>

      <section className="recovery-card" aria-labelledby="practice-heading">
        <h3 id="practice-heading" className="section-heading">
          2. Relaxed breathing
        </h3>
        <BreathingPractice
          key={run}
          now={now}
          onEnded={setEnded}
          onRestart={() => {
            setEnded(null);
            setAfter(null);
          }}
        />
      </section>

      {ended !== null && (
        <section className="recovery-card" aria-labelledby="after-heading">
          <h3 id="after-heading" className="section-heading">
            3. Check in again (optional)
          </h3>
          <StressCheckIn name="stress-after" legend="How stressed do you feel now?" value={after} onChange={setAfter} />
          {before !== null && after !== null && (
            <div data-testid="stress-comparison">
              <dl className="facts facts--compact">
                <div>
                  <dt>Before (your self-report)</dt>
                  <dd>{rated(before)}</dd>
                </div>
                <div>
                  <dt>After (your self-report{ended === 'stopped' ? ', practice stopped early' : ''})</dt>
                  <dd>{rated(after)}</dd>
                </div>
              </dl>
              <p className="muted">
                These are two answers you gave. A different number afterwards does not show that the breathing
                practice caused the change — how stressed we feel shifts for many reasons.
              </p>
            </div>
          )}
        </section>
      )}

      <div className="button-row">
        <button type="button" className="button" onClick={clear}>
          Clear my check-ins
        </button>
      </div>

      <FollowUpCard />
    </div>
  );
}

export default RecoveryView;
