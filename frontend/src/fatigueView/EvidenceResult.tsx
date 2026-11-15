import type { EvidenceResponse, NextCheck } from '../cognitive/types';
import { useT } from '../i18n';
import { KIND_UNIT, formatAge } from './labels';

type Props = {
  response: EvidenceResponse;
  /** Offered checks the user can start from here; others are listed as text only. */
  onCheck?: (code: NextCheck['code']) => void;
  availableChecks?: readonly NextCheck['code'][];
};

/** Evidence Navigator result: an inventory of what is known, missing or stale — not a diagnosis. */
export function EvidenceResult({ response, onCheck, availableChecks = [] }: Props) {
  const { t } = useT();
  return (
    <section className="fatigue-result" aria-label={t('ev.aria')} data-testid="evidence-result">
      <p className="fatigue-result__meta">
        <span className="tag">{t(`mode.${response.mode}`)}</span> {t('ev.subject')} <code>{response.subject_id}</code> ·{' '}
        {t('ev.asOf')} {response.as_of}
      </p>
      <p className="fatigue-result__status">{t(`assessment.${response.assessment_status}`)}</p>
      <div className="fatigue-table">
        <table>
          <caption className="visually-hidden">{t('ev.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('ev.col.evidence')}</th>
              <th scope="col">{t('ev.col.status')}</th>
              <th scope="col">{t('ev.col.value')}</th>
              <th scope="col">{t('ev.col.age')}</th>
              <th scope="col">{t('ev.col.source')}</th>
              <th scope="col">{t('ev.col.notes')}</th>
            </tr>
          </thead>
          <tbody>
            {response.evidence.map((item) => (
              <tr key={item.kind} data-kind={item.kind} data-status={item.status}>
                <th scope="row">{t(`kind.${item.kind}`)}</th>
                <td>{t(`status.${item.status}`)}</td>
                <td className="numeric">{item.value === null ? '—' : `${item.value} ${KIND_UNIT[item.kind]}`}</td>
                <td className="numeric">{formatAge(item.age_seconds)}</td>
                <td>{item.source === null ? '—' : t(`prov.${item.source.kind}`)}</td>
                <td>{item.issues.map((issue) => t(`issue.${issue}`)).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TextList title={t('ev.shows')} items={response.what_data_show} />
      <TextList title={t('ev.unknowns')} items={response.unknowns} />
      <TextList title={t('ev.limitations')} items={response.limitations} />
      {response.next_checks.length > 0 && (
        <div className="fatigue-checks">
          <p className="fatigue-list__title">{t('ev.checks')}</p>
          <div className="button-row">
            {response.next_checks.map((check) =>
              onCheck && availableChecks.includes(check.code) ? (
                <button key={check.code} type="button" className="button" onClick={() => onCheck(check.code)}>
                  {t(`check.${check.code}`)}
                </button>
              ) : (
                <span key={check.code} className="tag">
                  {t(`check.${check.code}`)}
                </span>
              ),
            )}
          </div>
        </div>
      )}
      {response.notices.length > 0 && (
        <TextList
          title={t('ev.notices')}
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
