import type { EvidenceResponse, NextCheck } from '../cognitive/types';
import {
  ASSESSMENT_LABEL,
  EVIDENCE_STATUS_LABEL,
  ISSUE_LABEL,
  KIND_LABEL,
  KIND_UNIT,
  MODE_LABEL,
  NEXT_CHECK_LABEL,
  PROVENANCE_LABEL,
  formatAge,
} from './labels';

type Props = {
  response: EvidenceResponse;
  /** Offered checks the user can start from here; others are listed as text only. */
  onCheck?: (code: NextCheck['code']) => void;
  availableChecks?: readonly NextCheck['code'][];
};

/** Evidence Navigator result: an inventory of what is known, missing or stale — not a diagnosis. */
export function EvidenceResult({ response, onCheck, availableChecks = [] }: Props) {
  return (
    <section className="fatigue-result" aria-label="Evidence inventory" data-testid="evidence-result">
      <p className="fatigue-result__meta">
        <span className="tag">{MODE_LABEL[response.mode]}</span> Subject <code>{response.subject_id}</code> · as of{' '}
        {response.as_of}
      </p>
      <p className="fatigue-result__status">{ASSESSMENT_LABEL[response.assessment_status]}</p>
      <div className="fatigue-table">
        <table>
          <caption className="visually-hidden">Evidence for the reported fatigue</caption>
          <thead>
            <tr>
              <th scope="col">Evidence</th>
              <th scope="col">Status</th>
              <th scope="col">Value</th>
              <th scope="col">Age</th>
              <th scope="col">Source</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {response.evidence.map((item) => (
              <tr key={item.kind} data-kind={item.kind}>
                <th scope="row">{KIND_LABEL[item.kind]}</th>
                <td>{EVIDENCE_STATUS_LABEL[item.status]}</td>
                <td className="numeric">{item.value === null ? '—' : `${item.value} ${KIND_UNIT[item.kind]}`}</td>
                <td className="numeric">{formatAge(item.age_seconds)}</td>
                <td>{item.source === null ? '—' : PROVENANCE_LABEL[item.source.kind]}</td>
                <td>{item.issues.map((issue) => ISSUE_LABEL[issue]).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TextList title="What the data show" items={response.what_data_show} />
      <TextList title="Unknowns" items={response.unknowns} />
      <TextList title="Limitations" items={response.limitations} />
      {response.next_checks.length > 0 && (
        <div className="fatigue-checks">
          <p className="fatigue-list__title">Optional checks (voluntary, not medical instructions)</p>
          <div className="button-row">
            {response.next_checks.map((check) =>
              onCheck && availableChecks.includes(check.code) ? (
                <button key={check.code} type="button" className="button" onClick={() => onCheck(check.code)}>
                  {NEXT_CHECK_LABEL[check.code]}
                </button>
              ) : (
                <span key={check.code} className="tag">
                  {NEXT_CHECK_LABEL[check.code]}
                </span>
              ),
            )}
          </div>
        </div>
      )}
      {response.notices.length > 0 && (
        <TextList
          title="Notices (unverified client input)"
          items={response.notices.map((n) => `${n.reported_at}: ${n.text}`)}
        />
      )}
    </section>
  );
}

export function TextList({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="fatigue-list">
      <p className="fatigue-list__title">{title}</p>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
