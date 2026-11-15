import { ILLUSTRATIVE_EVENT_DOSE_REFERENCE_MSV } from '../mission/types';
import type { Snapshot } from '../mission/types';
import { formatValue } from './labels';
import { useT } from '../i18n';

type Props = {
  environment: Snapshot['environment'];
};

/** Simulated module environment, kept separate from the crew health signals. */
export function EnvironmentStatus({ environment }: Props) {
  const { t } = useT();
  return (
    <section className="mission-environment" aria-labelledby="mission-environment-heading">
      <h3 id="mission-environment-heading" className="section-heading">
        {t('env.title')}
      </h3>
      {environment.particleEventActive && (
        <p className="mission-environment__event" role="status">
          {t('env.event')}
        </p>
      )}
      <dl className="facts facts--compact">
        <div>
          <dt>{t('env.eventDose')}</dt>
          <dd className="numeric">{formatValue(environment.eventDoseMSv, 1)} mSv</dd>
        </div>
        <div>
          <dt>{t('env.totalDose')}</dt>
          <dd className="numeric">{formatValue(environment.totalDoseMSv, 1)} mSv</dd>
        </div>
        <div>
          <dt>{t('env.co2')}</dt>
          <dd className="numeric">{formatValue(environment.co2, 2)}</dd>
        </div>
        <div>
          <dt>{t('env.noise')}</dt>
          <dd className="numeric">{formatValue(environment.noise, 1)} dB</dd>
        </div>
      </dl>
      <p className="muted mission-note">
        {t('env.note', { reference: ILLUSTRATIVE_EVENT_DOSE_REFERENCE_MSV })}
      </p>
    </section>
  );
}
