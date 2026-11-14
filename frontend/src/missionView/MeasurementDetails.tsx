import { cellDetail } from '../mission/detail';
import { domainLabels, metricLabels, outcomeLabels, stateLabels } from '../mission/explain';
import type { AlertView, Mission } from '../mission/types';
import type { CellSelection } from './CrewGrid';
import { MissionChart } from './MissionChart';
import { crewLabel, formatSigned, formatValue } from './labels';

type Props = {
  mission: Mission;
  selection: CellSelection | null;
  day: number;
  alerts: readonly AlertView[];
};

const RECENT_DAYS = 7;

export function MeasurementDetails({ mission, selection, day, alerts }: Props) {
  if (selection === null) {
    return (
      <section className="measurement" aria-labelledby="measurement-heading">
        <h3 id="measurement-heading" className="section-heading">
          Measurement details
        </h3>
        <p className="muted">Select a cell in the grid to see its synthetic measurements.</p>
      </section>
    );
  }

  const detail = cellDetail(mission, selection.crew, selection.domain, day);
  const metric = metricLabels[selection.domain];
  const heading = `${crewLabel(selection.crew)} · ${domainLabels[selection.domain]}`;
  const latest = alerts.find(
    (a) => a.domain === selection.domain && a.affected.includes(selection.crew),
  );
  const recent = detail.values.slice(-RECENT_DAYS).map((value, index, list) => ({
    day: detail.day - list.length + 1 + index,
    value,
  }));
  const range = detail.baseline
    ? `${formatValue(detail.baseline.lo, metric.decimals)}–${formatValue(detail.baseline.hi, metric.decimals)} ${metric.unit}`
    : 'not available yet';
  const summary =
    `Synthetic ${metric.label} of ${crewLabel(selection.crew).toLowerCase()} from day 1 to day ${detail.day}. ` +
    `Latest value ${formatValue(detail.value, metric.decimals)} ${metric.unit}; personal range ${range}.`;

  return (
    <section className="measurement" aria-labelledby="measurement-heading">
      <h3 id="measurement-heading" className="section-heading">
        Measurement details: {heading}
      </h3>
      <p className="measurement__state">
        <span className="event__category">{stateLabels[detail.state]}</span>
        <span className="muted"> · Day {detail.day}</span>
      </p>
      {detail.baseline === null && (
        <p className="muted">
          Personal baseline is being built from days 1–30 ({detail.baselineDaysCollected} of 30
          days collected). It is shown from day 31, when it is frozen.
        </p>
      )}
      <dl className="facts facts--compact">
        <div>
          <dt>Synthetic {metric.label}</dt>
          <dd className="numeric">
            {formatValue(detail.value, metric.decimals)} {metric.unit}
          </dd>
        </div>
        <div>
          <dt>Personal range (median ± 2 robust SD)</dt>
          <dd className="numeric">{range}</dd>
        </div>
        <div>
          <dt>Robust z-score</dt>
          <dd className="numeric">{formatSigned(detail.z)}</dd>
        </div>
        <div>
          <dt>EWMA of z</dt>
          <dd className="numeric">{formatSigned(detail.ewma)}</dd>
        </div>
        <div>
          <dt>CUSUM up / down (signal above 5)</dt>
          <dd className="numeric">
            {formatValue(detail.cusumHi, 2)} / {formatValue(detail.cusumLo, 2)}
          </dd>
        </div>
      </dl>
      <MissionChart
        values={detail.values}
        baseline={detail.baseline}
        label={metric.label}
        unit={metric.unit}
        decimals={metric.decimals}
        summary={summary}
      />
      <details className="data-table">
        <summary>Show the last {recent.length} days as a table</summary>
        <div className="data-table__scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">
                  {metric.label} ({metric.unit})
                </th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => (
                <tr key={row.day}>
                  <td className="numeric">{row.day}</td>
                  <td className="numeric">{formatValue(row.value, metric.decimals)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <div className="measurement__latest">
        <p className="event-feed__subheading">Latest notification for this measurement</p>
        {latest === undefined ? (
          <p className="muted">None so far.</p>
        ) : (
          <>
            <p className="event__meta">
              {stateLabels[latest.category]} · Day {latest.day} · {outcomeLabels[latest.outcome]}
            </p>
            <p className="event__text">{latest.text}</p>
            {latest.followUpText !== null && <p className="event__follow">{latest.followUpText}</p>}
          </>
        )}
      </div>
    </section>
  );
}
