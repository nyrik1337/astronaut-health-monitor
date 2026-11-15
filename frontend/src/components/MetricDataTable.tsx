import { formatDateTime, formatNumber, withUnit } from '../domain/format';
import type { MetricDefinition } from '../domain/metrics';
import type { SeriesPoint } from '../domain/readings';
import { useT } from '../i18n';
import { vitalLabel } from './vitalLabel';

type Props = {
  definition: MetricDefinition;
  series: readonly SeriesPoint[];
};

/** Text alternative to the chart, newest reading first. */
export function MetricDataTable({ definition, series }: Props) {
  const { t } = useT();
  const label = vitalLabel(definition, t);
  const rows = [...series].reverse();
  return (
    <details className="data-table">
      <summary>{t('mt.show', { metric: label })}</summary>
      <div className="data-table__scroll">
        <table>
          <caption className="visually-hidden">{t('mt.caption', { metric: label })}</caption>
          <thead>
            <tr>
              <th scope="col">{t('mt.time')}</th>
              <th scope="col">{withUnit(label, `(${definition.unit || 'value'})`)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((point) => (
              <tr key={point.timestamp}>
                <td>{formatDateTime(point.time)}</td>
                <td className="numeric">
                  {point.value === null ? <span className="muted">{t('mt.missing')}</span> : formatNumber(point.value, definition.decimals)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
