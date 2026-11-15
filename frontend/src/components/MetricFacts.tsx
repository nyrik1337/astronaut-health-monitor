import { type MetricAnalysisView, signedDifference } from '../domain/analysisView';
import { formatNumber, formatSigned, withUnit } from '../domain/format';
import { useT } from '../i18n';
import type { MetricDefinition } from '../domain/metrics';

type Props = {
  definition: MetricDefinition;
  view: MetricAnalysisView;
};

const Z_SCORE_DECIMALS = 2;

export function MetricFacts({ definition, view }: Props) {
  const { t } = useT();
  if (view.kind === 'pending') {
    return <p className="metric__analysis muted">{t('mf.analyzing')}</p>;
  }
  if (view.kind === 'unavailable') {
    return <p className="metric__analysis muted">{view.reason}</p>;
  }

  const { result, minimumSamples } = view;
  const { decimals, unit } = definition;
  const difference = signedDifference(result);
  const zScore = result.deviation?.robust_z_score ?? null;

  return (
    <div className="metric__analysis">
      <p className="metric__status">{t(`mst.${result.status}`)}</p>
      <p className="metric__description">
        {t(`mdesc.${result.status}`, { n: result.history_samples, min: minimumSamples })}
      </p>
      {result.baseline !== null && (
        <dl className="facts facts--compact">
          <div>
            <dt>
              <span className="median-swatch" aria-hidden="true" />
              {t('mf.median')}
            </dt>
            <dd className="numeric">{withUnit(formatNumber(result.baseline.median, decimals), unit)}</dd>
          </div>
          <div>
            <dt>{t('mf.difference')}</dt>
            <dd className="numeric">{difference === null ? t('mf.na') : withUnit(formatSigned(difference, decimals), unit)}</dd>
          </div>
          <div>
            <dt>{t('mf.z')}</dt>
            <dd className="numeric">{zScore === null ? t('mf.na') : formatSigned(zScore, Z_SCORE_DECIMALS)}</dd>
          </div>
          <div>
            <dt>MAD</dt>
            <dd className="numeric">{withUnit(formatNumber(result.baseline.mad, decimals + 1), unit)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
