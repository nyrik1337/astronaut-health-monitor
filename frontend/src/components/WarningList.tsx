import type { AnalysisWarning } from '../api/types';
import { getMetricDefinition } from '../domain/metrics';
import { useT } from '../i18n';
import { vitalLabel } from './vitalLabel';

type Props = {
  warnings: readonly AnalysisWarning[] | null;
};

export function WarningList({ warnings }: Props) {
  const { t } = useT();
  return (
    <section className="warnings" aria-labelledby="warnings-heading">
      <h2 id="warnings-heading" className="section-heading">
        {t('wl.title')}
        {warnings !== null && <span className="numeric section-heading__count"> {warnings.length}</span>}
      </h2>
      {warnings === null && <p className="muted">{t('wl.pending')}</p>}
      {warnings !== null && warnings.length === 0 && <p>{t('wl.none')}</p>}
      {warnings !== null && warnings.length > 0 && (
        <ul className="warnings__list">
          {warnings.map((warning) => (
            <li key={`${warning.code}-${warning.metric ?? 'request'}`} className="warning">
              <p className="warning__subject">
                {warning.metric === null ? t('wl.whole') : vitalLabel(getMetricDefinition(warning.metric), t)}
              </p>
              <p className="warning__message">{warning.message}</p>
              <p className="warning__code">
                <code>{warning.code}</code>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
