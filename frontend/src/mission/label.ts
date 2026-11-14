/**
 * SYNTHETIC MISSION SIMULATION — ground-truth labelling.
 *
 * Links an alert to a scripted scenario by crew member, domain and detection day. The detectors
 * never see this; it only feeds the false-alarm counter and the tests.
 */
import type { Alert, ScenarioEvent } from './types';

const LEAD_DAYS = 2;
const TAIL_DAYS = 5;

function matches(alert: Alert, event: ScenarioEvent): boolean {
  if (alert.domain !== event.domain) return false;
  if (alert.detectedDay < event.startDay - LEAD_DAYS) return false;
  if (alert.detectedDay > event.endDay + TAIL_DAYS) return false;
  if (alert.crew) return event.crew.includes(alert.crew);
  return alert.affected.some((c) => event.crew.includes(c));
}

export function labelAlert(alert: Alert, events: readonly ScenarioEvent[]): Alert {
  const event = events.find((e) => matches(alert, e));
  return { ...alert, scenarioId: event?.id ?? null, falsePositive: event === undefined };
}
