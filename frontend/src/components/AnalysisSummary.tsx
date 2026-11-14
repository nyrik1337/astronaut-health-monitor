import type { AnalyzeResponse } from '../api/types';
import { formatDateTime } from '../domain/format';
import { ANALYSIS_STATUS_DESCRIPTIONS, ANALYSIS_STATUS_LABELS, baselineMethodLabel } from '../domain/labels';
import type { AnalysisState } from '../hooks/useAnalysis';
import { ErrorNotice } from './ErrorNotice';

type Props = {
  state: AnalysisState;
  analysis: AnalyzeResponse | null;
  historyCount: number;
  onRetry: () => void;
};

function liveMessage(state: AnalysisState, analysis: AnalyzeResponse | null): string {
  if (analysis !== null) {
    return `Analysis ${ANALYSIS_STATUS_LABELS[analysis.analysis_status].toLowerCase()}.`;
  }
  if (state.phase === 'idle') {
    return 'There is no reading to analyze.';
  }
  return state.phase === 'error' ? '' : 'Analyzing the latest reading…';
}

export function AnalysisSummary({ state, analysis, historyCount, onRetry }: Props) {
  return (
    <section className="summary" aria-labelledby="summary-heading" aria-busy={analysis === null && state.phase === 'loading'}>
      <h2 id="summary-heading" className="section-heading">
        Analysis
      </h2>
      <p className="summary__live" role="status" aria-live="polite">
        {liveMessage(state, analysis)}
      </p>
      {state.phase === 'error' && <ErrorNotice error={state.error} onRetry={onRetry} />}
      {analysis !== null && (
        <>
          <p className="summary__status">{ANALYSIS_STATUS_LABELS[analysis.analysis_status]}</p>
          <p className="summary__description">{ANALYSIS_STATUS_DESCRIPTIONS[analysis.analysis_status]}</p>
          <dl className="facts">
            <div>
              <dt>Reading time</dt>
              <dd>{formatDateTime(analysis.timestamp)}</dd>
            </div>
            <div>
              <dt>Baseline method</dt>
              <dd>{baselineMethodLabel(analysis.baseline_method)}</dd>
            </div>
            <div>
              <dt>Minimum history values</dt>
              <dd className="numeric">{analysis.minimum_history_samples}</dd>
            </div>
            <div>
              <dt>History records submitted</dt>
              <dd className="numeric">{historyCount}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}
