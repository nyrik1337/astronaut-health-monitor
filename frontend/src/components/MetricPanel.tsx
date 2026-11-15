import type { MetricAnalysisView } from '../domain/analysisView';
import { formatNumber } from '../domain/format';
import type { MetricDefinition } from '../domain/metrics';
import { countMissing, type SeriesPoint } from '../domain/readings';
import { MetricChart } from './MetricChart';
import { MetricDataTable } from './MetricDataTable';
import { MetricFacts } from './MetricFacts';
import { useT } from '../i18n';
import { vitalLabel } from './vitalLabel';

type Props = {
  folio: number;
  definition: MetricDefinition;
  series: readonly SeriesPoint[];
  view: MetricAnalysisView;
};

export function MetricPanel({ folio, definition, series, view }: Props) {
  const { t } = useT();
  const label = vitalLabel(definition, t);
  const headingId = `metric-${definition.key}`;
  const current = series.at(-1)?.value ?? null;
  const missing = countMissing(series);
  const median = view.kind === 'ready' ? (view.result.baseline?.median ?? null) : null;

  return (
    <article className="metric" aria-labelledby={headingId}>
      <p className="metric__folio" aria-hidden="true">
        {String(folio).padStart(2, '0')}
      </p>
      <div className="metric__reading">
        <h3 id={headingId} className="metric__title">
          {label}
        </h3>
        {current === null ? (
          <p className="metric__value metric__value--missing">{t('mp.noCurrent')}</p>
        ) : (
          <p className="metric__value">
            <span className="numeric">{formatNumber(current, definition.decimals)}</span>
            <span className="metric__unit">{definition.unit}</span>
          </p>
        )}
        <MetricFacts definition={definition} view={view} />
      </div>
      <div className="metric__history">
        <MetricChart definition={definition} series={series} median={median} />
        {missing > 0 && (
          <p className="muted metric__gaps">
            {t('mp.gaps', { missing, total: series.length, metric: label })}
          </p>
        )}
        <MetricDataTable definition={definition} series={series} />
      </div>
    </article>
  );
}
