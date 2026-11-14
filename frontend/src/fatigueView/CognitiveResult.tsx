import type { CognitiveResponse } from '../cognitive/types';
import { TextList } from './EvidenceResult';
import {
  ANALYSIS_LABEL,
  DISPOSITION_LABEL,
  MODE_LABEL,
  NEXT_CHECK_LABEL,
  REASON_LABEL,
  formatMs,
  formatSignedMs,
} from './labels';

/** CognitiveGuard result: an experimental personal summary — no risk, impairment or fitness label. */
export function CognitiveResult({ response }: { response: CognitiveResponse }) {
  const { current, baseline } = response;
  return (
    <section className="fatigue-result" aria-label="Reaction-time summary" data-testid="cognitive-result">
      <p className="fatigue-result__meta">
        <span className="tag">{MODE_LABEL[response.mode]}</span> Session <code>{response.session_id}</code> · ended{' '}
        {response.timestamp}
      </p>
      <p className="fatigue-result__status">{ANALYSIS_LABEL[response.analysis_status]}</p>
      <dl className="facts facts--compact">
        <div>
          <dt>Median reaction time</dt>
          <dd className="numeric">{formatMs(current.median_reaction_time_ms)}</dd>
        </div>
        <div>
          <dt>90th percentile</dt>
          <dd className="numeric">{formatMs(current.p90_reaction_time_ms)}</dd>
        </div>
        <div>
          <dt>Valid / early / missed</dt>
          <dd className="numeric">
            {current.valid_trials} / {current.early_responses} / {current.missed_responses}
          </dd>
        </div>
        <div>
          <dt>{response.mode === 'simulation' ? 'Synthetic baseline (scripted history)' : 'Personal baseline (your earlier checks)'}</dt>
          <dd className="numeric" data-testid="cognitive-baseline">
            {baseline === null
              ? 'Not available'
              : `${baseline.median_reaction_time_ms} ms (${formatSignedMs(baseline.signed_difference_ms)})`}
          </dd>
        </div>
      </dl>
      {response.history_evaluation.length > 0 && (
        <details className="data-table">
          <summary>History used ({response.history_evaluation.length} sessions)</summary>
          <div className="data-table__scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Session</th>
                  <th scope="col">Use</th>
                  <th scope="col">Reasons</th>
                </tr>
              </thead>
              <tbody>
                {response.history_evaluation.map((h) => (
                  <tr key={h.session_id}>
                    <td>
                      <code>{h.session_id}</code>
                    </td>
                    <td>{DISPOSITION_LABEL[h.disposition]}</td>
                    <td>{h.reasons.map((r) => REASON_LABEL[r]).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <TextList title="What the data show" items={response.what_data_show} />
      <TextList title="Limitations" items={response.limitations} />
      {response.next_checks.length > 0 && (
        <TextList
          title="Optional next step (voluntary, not a medical instruction)"
          items={response.next_checks.map((c) => NEXT_CHECK_LABEL[c.code])}
        />
      )}
    </section>
  );
}
