import { domainLabels, outcomeLabels, stateLabels } from '../mission/explain';
import type { Snapshot } from '../mission/types';
import {
  crewLabel,
  delayText,
  detectionKindLabel,
  detectionStatusText,
  waitingText,
} from './labels';

type Props = {
  snapshot: Snapshot;
};

/** Notifications (what the crew would see) and initial detections (what the detectors found). */
export function EventFeed({ snapshot }: Props) {
  const notifiedDay = new Map(snapshot.alerts.map((a) => [a.id, a.day]));

  return (
    <section className="event-feed" aria-labelledby="event-feed-heading">
      <h3 id="event-feed-heading" className="section-heading">
        Event feed
      </h3>
      <dl className="facts facts--compact">
        <div>
          <dt>Notifications</dt>
          <dd className="numeric" data-testid="count-notifications">
            {snapshot.counters.total}
          </dd>
        </div>
        <div>
          <dt>Initial detections</dt>
          <dd className="numeric" data-testid="count-detections">
            {snapshot.detections.length}
          </dd>
        </div>
        <div>
          <dt>Waiting</dt>
          <dd className="numeric">{snapshot.queue.length}</dd>
        </div>
        <div>
          <dt>Not explained by a scripted event</dt>
          <dd className="numeric">{snapshot.counters.falseAlarms}</dd>
        </div>
      </dl>

      <h4 className="event-feed__subheading">Notifications</h4>
      {snapshot.alerts.length === 0 ? (
        <p className="muted">No notifications yet.</p>
      ) : (
        <ol className="event-feed__list" aria-label="Notifications, newest first">
          {snapshot.alerts.map((alert) => (
            <li key={alert.id} className="event" data-category={alert.category}>
              <p className="event__meta">
                <span className="event__category">{stateLabels[alert.category]}</span>
                <span className="numeric"> · Day {alert.day}</span>
                {alert.outcome !== 'open' && <span> · {outcomeLabels[alert.outcome]}</span>}
              </p>
              <p className="event__title">{alert.title}</p>
              <p className="event__text">{alert.text}</p>
              {delayText(alert) !== null && <p className="event__delay">{delayText(alert)}</p>}
              {alert.followUpText !== null && <p className="event__follow">{alert.followUpText}</p>}
            </li>
          ))}
        </ol>
      )}

      {snapshot.queue.length > 0 && (
        <>
          <h4 className="event-feed__subheading">Waiting to be notified</h4>
          <ul className="event-feed__list">
            {snapshot.queue.map((alert) => (
              <li key={alert.id} className="event event--waiting">
                <p className="event__title">{alert.title}</p>
                <p className="event__delay">{waitingText(alert, snapshot.day)}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      <h4 className="event-feed__subheading">Initial detections</h4>
      {snapshot.detections.length === 0 ? (
        <p className="muted">No detector has fired yet.</p>
      ) : (
        <ol className="event-feed__list" aria-label="Initial detections, newest first">
          {snapshot.detections.map((d) => (
            <li key={d.id} className="detection" data-status={d.status}>
              <p className="event__meta numeric">
                Day {d.day} · {crewLabel(d.crew)} · {domainLabels[d.domain]}
              </p>
              <p>{detectionKindLabel(d)}</p>
              <p className="event__delay">
                {detectionStatusText(d, d.alertId === null ? null : (notifiedDay.get(d.alertId) ?? null))}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
