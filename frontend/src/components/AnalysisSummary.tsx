import type { AnalyzeResponse } from '../api/types';
import { formatDateTime } from '../domain/format';
import { isKey, useT, type TFn } from '../i18n';
import type { AnalysisState } from '../hooks/useAnalysis';
import { ErrorNotice } from './ErrorNotice';

type Props = {
  state: AnalysisState;
  analysis: AnalyzeResponse | null;
  historyCount: number;
  onRetry: () => void;
};

function liveMessage(state: AnalysisState, analysis: AnalyzeResponse | null, t: TFn): string {
  if (analysis !== null) {
    return t('db.live.status', { status: t(`as.${analysis.analysis_status}`).toLowerCase() });
  }
  if (state.phase === 'idle') {
    return t('db.live.idle');
  }
  return state.phase === 'error' ? '' : t('db.live.loading');
}

function methodLabel(method: string, t: TFn): string {
  const key = `db.method.${method}`;
  return isKey(key) ? t(key) : method;
}

export function AnalysisSummary({ state, analysis, historyCount, onRetry }: Props) {
  const { t } = useT();
  return (
    <section className="summary" aria-labelledby="summary-heading" aria-busy={analysis === null && state.phase === 'loading'}>
      <h2 id="summary-heading" className="section-heading">
        {t('db.analysis')}
      </h2>
      <p className="summary__live" role="status" aria-live="polite">
        {liveMessage(state, analysis, t)}
      </p>
      {state.phase === 'error' && <ErrorNotice error={state.error} onRetry={onRetry} />}
      {analysis !== null && (
        <>
          <p className="summary__status">{t(`as.${analysis.analysis_status}`)}</p>
          <p className="summary__description">{t(`asd.${analysis.analysis_status}`)}</p>
          <dl className="facts">
            <div>
              <dt>{t('db.readingTime')}</dt>
              <dd>{formatDateTime(analysis.timestamp)}</dd>
            </div>
            <div>
              <dt>{t('db.method')}</dt>
              <dd>{methodLabel(analysis.baseline_method, t)}</dd>
            </div>
            <div>
              <dt>{t('db.minHistory')}</dt>
              <dd className="numeric">{analysis.minimum_history_samples}</dd>
            </div>
            <div>
              <dt>{t('db.submitted')}</dt>
              <dd className="numeric">{historyCount}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}
