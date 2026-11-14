import { formatDateTime, formatNumber, withUnit } from '../domain/format';
import type { MetricDefinition } from '../domain/metrics';
import type { SeriesPoint } from '../domain/readings';

type Props = {
  definition: MetricDefinition;
  series: readonly SeriesPoint[];
};

/** Text alternative to the chart, newest reading first. */
export function MetricDataTable({ definition, series }: Props) {
  const rows = [...series].reverse();
  return (
    <details className="data-table">
      <summary>Show {definition.label} readings as a table</summary>
      <div className="data-table__scroll">
        <table>
          <caption className="visually-hidden">{definition.label} readings, newest first</caption>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">{withUnit(definition.label, `(${definition.unit || 'value'})`)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((point) => (
              <tr key={point.timestamp}>
                <td>{formatDateTime(point.time)}</td>
                <td className="numeric">
                  {point.value === null ? <span className="muted">Missing</span> : formatNumber(point.value, definition.decimals)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
