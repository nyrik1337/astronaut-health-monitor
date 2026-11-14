import type { AnalysisWarning } from '../api/types';
import { getMetricDefinition } from '../domain/metrics';

type Props = {
  warnings: readonly AnalysisWarning[] | null;
};

export function WarningList({ warnings }: Props) {
  return (
    <section className="warnings" aria-labelledby="warnings-heading">
      <h2 id="warnings-heading" className="section-heading">
        Analysis warnings
        {warnings !== null && <span className="numeric section-heading__count"> {warnings.length}</span>}
      </h2>
      {warnings === null && <p className="muted">Warnings appear when an analysis completes.</p>}
      {warnings !== null && warnings.length === 0 && <p>No warnings for the latest reading.</p>}
      {warnings !== null && warnings.length > 0 && (
        <ul className="warnings__list">
          {warnings.map((warning) => (
            <li key={`${warning.code}-${warning.metric ?? 'request'}`} className="warning">
              <p className="warning__subject">
                {warning.metric === null ? 'Whole request' : getMetricDefinition(warning.metric).label}
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
