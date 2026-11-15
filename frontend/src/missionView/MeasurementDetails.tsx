import { cellDetail } from '../mission/detail';
import { metricLabels } from '../mission/explain';
import { useT } from '../i18n';
import type { AlertView, Mission } from '../mission/types';
import type { CellSelection } from './CrewGrid';
import { MissionChart } from './MissionChart';
import { formatSigned, formatValue } from './labels';

type Props = {
  mission: Mission;
  selection: CellSelection | null;
  day: number;
  alerts: readonly AlertView[];
};

const RECENT_DAYS = 7;

export function MeasurementDetails({ mission, selection, day, alerts }: Props) {
  const { t } = useT();
  if (selection === null) {
    return (
      <section className="measurement" aria-labelledby="measurement-heading">
        <h3 id="measurement-heading" className="section-heading">
          {t('md.title')}
        </h3>
        <p className="muted">{t('md.select')}</p>
      </section>
    );
  }

  const detail = cellDetail(mission, selection.crew, selection.domain, day);
  const metric = { ...metricLabels[selection.domain], label: t(`metric.${selection.domain}`) };
  const crewName = t('cg.member', { crew: selection.crew });
  const heading = `${crewName} · ${t(`domain.${selection.domain}`)}`;
  const latest = alerts.find(
    (a) => a.domain === selection.domain && a.affected.includes(selection.crew),
  );
  const recent = detail.values.slice(-RECENT_DAYS).map((value, index, list) => ({
    day: detail.day - list.length + 1 + index,
    value,
  }));
  const range = detail.baseline
    ? `${formatValue(detail.baseline.lo, metric.decimals)}–${formatValue(detail.baseline.hi, metric.decimals)} ${metric.unit}`
    : t('md.rangeNone');
  const summary = t('md.summary', {
    metric: metric.label,
    crew: crewName,
    day: detail.day,
    value: formatValue(detail.value, metric.decimals),
    unit: metric.unit,
    range,
  });

  return (
    <section className="measurement" aria-labelledby="measurement-heading">
      <h3 id="measurement-heading" className="section-heading">
        {t('md.title')}: {heading}
      </h3>
      <p className="measurement__state">
        <span className="event__category">{t(`state.${detail.state}`)}</span>
        <span className="muted"> · {t('md.day', { day: detail.day })}</span>
      </p>
      {detail.baseline === null && (
        <p className="muted">
          {t('md.building', { collected: detail.baselineDaysCollected })}
        </p>
      )}
      <dl className="facts facts--compact">
        <div>
          <dt>{t('md.synthetic', { metric: metric.label })}</dt>
          <dd className="numeric">
            {formatValue(detail.value, metric.decimals)} {metric.unit}
          </dd>
        </div>
        <div>
          <dt>{t('md.range')}</dt>
          <dd className="numeric">{range}</dd>
        </div>
        <div>
          <dt>{t('md.z')}</dt>
          <dd className="numeric">{formatSigned(detail.z)}</dd>
        </div>
        <div>
          <dt>{t('md.ewma')}</dt>
          <dd className="numeric">{formatSigned(detail.ewma)}</dd>
        </div>
        <div>
          <dt>{t('md.cusum')}</dt>
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
        <summary>{t('md.table', { count: recent.length })}</summary>
        <div className="data-table__scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('md.colDay')}</th>
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
        <p className="event-feed__subheading">{t('md.latest')}</p>
        {latest === undefined ? (
          <p className="muted">{t('md.none')}</p>
        ) : (
          <>
            <p className="event__meta">
              {t(`state.${latest.category}`)} · {t('md.day', { day: latest.day })} · {t(`outcome.${latest.outcome}`)}
            </p>
            <p className="event__text">{latest.text}</p>
            {latest.followUpText !== null && <p className="event__follow">{latest.followUpText}</p>}
          </>
        )}
      </div>
    </section>
  );
}
