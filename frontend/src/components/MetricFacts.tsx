import { type MetricAnalysisView, signedDifference } from '../domain/analysisView';
import { formatNumber, formatSigned, withUnit } from '../domain/format';
import { describeMetricResult, METRIC_STATUS_LABELS } from '../domain/labels';
import type { MetricDefinition } from '../domain/metrics';

type Props = {
  definition: MetricDefinition;
  view: MetricAnalysisView;
};

const Z_SCORE_DECIMALS = 2;

export function MetricFacts({ definition, view }: Props) {
  if (view.kind === 'pending') {
    return <p className="metric__analysis muted">Analyzing…</p>;
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
      <p className="metric__status">{METRIC_STATUS_LABELS[result.status]}</p>
      <p className="metric__description">{describeMetricResult(result, minimumSamples)}</p>
      {result.baseline !== null && (
        <dl className="facts facts--compact">
          <div>
            <dt>
              <span className="median-swatch" aria-hidden="true" />
              Personal median
            </dt>
            <dd className="numeric">{withUnit(formatNumber(result.baseline.median, decimals), unit)}</dd>
          </div>
          <div>
            <dt>Difference from median</dt>
            <dd className="numeric">{difference === null ? 'Not available' : withUnit(formatSigned(difference, decimals), unit)}</dd>
          </div>
          <div>
            <dt>Robust z-score</dt>
            <dd className="numeric">{zScore === null ? 'Not available' : formatSigned(zScore, Z_SCORE_DECIMALS)}</dd>
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
