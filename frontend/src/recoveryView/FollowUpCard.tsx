import { Rich, useT } from '../i18n';

/** Explains how the existing mission simulation follows up a flagged value, without causal claims. */
export function FollowUpCard() {
  const { t } = useT();
  return (
    <section className="recovery-card" aria-labelledby="follow-up-heading">
      <h3 id="follow-up-heading" className="section-heading">
        {t('fu.title')}
      </h3>
      <p>
        <Rich text={t('fu.p1')} />
      </p>
      <p>{t('fu.p2')}</p>
    </section>
  );
}
