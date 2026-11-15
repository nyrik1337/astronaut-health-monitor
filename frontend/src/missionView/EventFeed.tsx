import type { Snapshot } from '../mission/types';
import { useT } from '../i18n';
import { crewLabelT, delayTextT, detectionKindLabelT, detectionStatusTextT, waitingTextT } from './labels';

type Props = {
  snapshot: Snapshot;
};

/** Notifications (what the crew would see) and initial detections (what the detectors found). */
export function EventFeed({ snapshot }: Props) {
  const { t } = useT();
  const notifiedDay = new Map(snapshot.alerts.map((a) => [a.id, a.day]));

  return (
    <section className="event-feed" aria-labelledby="event-feed-heading">
      <h3 id="event-feed-heading" className="section-heading">
        {t('ef.title')}
      </h3>
      <dl className="facts facts--compact">
        <div>
          <dt>{t('ef.notifications')}</dt>
          <dd className="numeric" data-testid="count-notifications">
            {snapshot.counters.total}
          </dd>
        </div>
        <div>
          <dt>{t('ef.detections')}</dt>
          <dd className="numeric" data-testid="count-detections">
            {snapshot.detections.length}
          </dd>
        </div>
        <div>
          <dt>{t('ef.waiting')}</dt>
          <dd className="numeric">{snapshot.queue.length}</dd>
        </div>
        <div>
          <dt>{t('ef.unexplained')}</dt>
          <dd className="numeric">{snapshot.counters.falseAlarms}</dd>
        </div>
      </dl>

      <h4 className="event-feed__subheading">{t('ef.notifications')}</h4>
      <p className="muted">{t('ms.narrative')}</p>
      {snapshot.alerts.length === 0 ? (
        <p className="muted">{t('ef.none')}</p>
      ) : (
        <ol className="event-feed__list" aria-label={t('ef.listNotifications')}>
          {snapshot.alerts.map((alert) => (
            <li key={alert.id} className="event" data-category={alert.category}>
              <p className="event__meta">
                <span className="event__category">{t(`state.${alert.category}`)}</span>
                <span className="numeric"> · {t('ef.day', { day: alert.day })}</span>
                {alert.outcome !== 'open' && <span> · {t(`outcome.${alert.outcome}`)}</span>}
              </p>
              <p className="event__title">{alert.title}</p>
              <p className="event__text">{alert.text}</p>
              {delayTextT(alert, t) !== null && <p className="event__delay">{delayTextT(alert, t)}</p>}
              {alert.followUpText !== null && <p className="event__follow">{alert.followUpText}</p>}
            </li>
          ))}
        </ol>
      )}

      {snapshot.queue.length > 0 && (
        <>
          <h4 className="event-feed__subheading">{t('ef.waitingTitle')}</h4>
          <ul className="event-feed__list">
            {snapshot.queue.map((alert) => (
              <li key={alert.id} className="event event--waiting">
                <p className="event__title">{alert.title}</p>
                <p className="event__delay">{waitingTextT(alert, snapshot.day, t)}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      <h4 className="event-feed__subheading">{t('ef.detections')}</h4>
      {snapshot.detections.length === 0 ? (
        <p className="muted">{t('ef.noDetections')}</p>
      ) : (
        <ol className="event-feed__list" aria-label={t('ef.listDetections')}>
          {snapshot.detections.map((d) => (
            <li key={d.id} className="detection" data-status={d.status}>
              <p className="event__meta numeric">
                {t('ef.day', { day: d.day })} · {crewLabelT(d.crew, t)} · {t(`domain.${d.domain}`)}
              </p>
              <p>{detectionKindLabelT(d, t)}</p>
              <p className="event__delay">
                {detectionStatusTextT(d, d.alertId === null ? null : (notifiedDay.get(d.alertId) ?? null), t)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
