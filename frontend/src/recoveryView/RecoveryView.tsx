import { useState } from 'react';
import { BreathingPractice } from './BreathingPractice';
import { FollowUpCard } from './FollowUpCard';
import { StressCheckIn, type StressRating } from './StressCheckIn';
import { Rich, useT, type TFn } from '../i18n';
import './recovery.css';

type Ended = 'stopped' | 'completed';

const rated = (value: StressRating, t: TFn): string => `${value} / 5 (${t(`mg.rating.${value}`)})`;

/**
 * MindGuard Recovery Loop: voluntary stress self-report, a short relaxed-breathing practice and an
 * optional second self-report. Everything stays in this component's memory — nothing is stored in
 * the browser or sent to a server — and nothing here is a diagnosis or a treatment.
 */
export function RecoveryView({ now }: { now?: () => number }) {
  const { t } = useT();
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
          {t('mg.title')}
        </h2>
        <p className="mission__notice">
          <Rich text={t('mg.intro')} />
        </p>
      </div>

      <section className="recovery-card" aria-labelledby="before-heading">
        <h3 id="before-heading" className="section-heading">
          {t('mg.step1')}
        </h3>
        <StressCheckIn name="stress-before" legend={t('mg.before')} value={before} onChange={setBefore} />
      </section>

      <section className="recovery-card" aria-labelledby="practice-heading">
        <h3 id="practice-heading" className="section-heading">
          {t('mg.step2')}
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
            {t('mg.step3')}
          </h3>
          <StressCheckIn name="stress-after" legend={t('mg.after')} value={after} onChange={setAfter} />
          {before !== null && after !== null && (
            <div data-testid="stress-comparison">
              <dl className="facts facts--compact">
                <div>
                  <dt>{t('mg.beforeLabel')}</dt>
                  <dd>{rated(before, t)}</dd>
                </div>
                <div>
                  <dt>{ended === 'stopped' ? t('mg.afterStopped') : t('mg.afterLabel')}</dt>
                  <dd>{rated(after, t)}</dd>
                </div>
              </dl>
              <p className="muted">
                {t('mg.noCausal')}
              </p>
            </div>
          )}
        </section>
      )}

      <div className="button-row">
        <button type="button" className="button" onClick={clear}>
          {t('mg.clear')}
        </button>
      </div>

      <FollowUpCard />
    </div>
  );
}

export default RecoveryView;
