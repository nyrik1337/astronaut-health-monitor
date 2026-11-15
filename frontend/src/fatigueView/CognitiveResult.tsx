import type { CognitiveResponse } from '../cognitive/types';
import { TextList } from './EvidenceResult';
import { useT } from '../i18n';
import { formatMs, formatSignedMs } from './labels';

/** CognitiveGuard result: an experimental personal summary — no risk, impairment or fitness label. */
export function CognitiveResult({ response }: { response: CognitiveResponse }) {
  const { t } = useT();
  const { current, baseline } = response;
  return (
    <section className="fatigue-result" aria-label={t('cog.aria')} data-testid="cognitive-result">
      <p className="fatigue-result__meta">
        <span className="tag">{t(`mode.${response.mode}`)}</span> {t('cog.session')} <code>{response.session_id}</code> ·{' '}
        {t('cog.ended')} {response.timestamp}
      </p>
      <p className="fatigue-result__status">{t(`analysis.${response.analysis_status}`)}</p>
      <dl className="facts facts--compact">
        <div>
          <dt>{t('cog.median')}</dt>
          <dd className="numeric">{formatMs(current.median_reaction_time_ms)}</dd>
        </div>
        <div>
          <dt>{t('cog.p90')}</dt>
          <dd className="numeric">{formatMs(current.p90_reaction_time_ms)}</dd>
        </div>
        <div>
          <dt>{t('cog.counts')}</dt>
          <dd className="numeric">
            {current.valid_trials} / {current.early_responses} / {current.missed_responses}
          </dd>
        </div>
        <div>
          <dt>{t(`cog.baseline.${response.mode}`)}</dt>
          <dd className="numeric" data-testid="cognitive-baseline">
            {baseline === null
              ? t('cog.na')
              : `${baseline.median_reaction_time_ms} ms (${formatSignedMs(baseline.signed_difference_ms)})`}
          </dd>
        </div>
      </dl>
      {response.history_evaluation.length > 0 && (
        <details className="data-table">
          <summary>{t('cog.history', { count: response.history_evaluation.length })}</summary>
          <div className="data-table__scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('cog.col.session')}</th>
                  <th scope="col">{t('cog.col.use')}</th>
                  <th scope="col">{t('cog.col.reasons')}</th>
                </tr>
              </thead>
              <tbody>
                {response.history_evaluation.map((h) => (
                  <tr key={h.session_id}>
                    <td>
                      <code>{h.session_id}</code>
                    </td>
                    <td>{t(`disposition.${h.disposition}`)}</td>
                    <td>{h.reasons.map((r) => t(`reason.${r}`)).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <TextList title={t('ev.shows')} items={response.what_data_show} />
      <TextList title={t('ev.limitations')} items={response.limitations} />
      {response.next_checks.length > 0 && (
        <TextList
          title={t('cog.next')}
          items={response.next_checks.map((c) => t(`check.${c.code}`))}
        />
      )}
    </section>
  );
}
