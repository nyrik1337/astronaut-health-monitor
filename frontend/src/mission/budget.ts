/**
 * SYNTHETIC MISSION SIMULATION — alert budget (experimental).
 *
 * At most N non-environmental alerts are shown per crew member per day; the rest wait in a queue
 * in review order. Nothing is removed: a deferred alert keeps its detection day, stays in the
 * mission's alert list and appears in the snapshot queue until it is shown. An alert that cannot
 * be shown before the mission ends gets day NOT_SHOWN_DAY and stays queued.
 */
import { MISSION_DAYS } from './types';
import type { Alert, CrewId } from './types';
import { REVIEW_ORDER } from './signals';

export const DEFAULT_BUDGET = 2;
/** Shown day of an alert that never fitted into the budget during the mission. */
export const NOT_SHOWN_DAY = MISSION_DAYS + 1;

const byReviewOrder = (a: Alert, b: Alert): number =>
  REVIEW_ORDER[a.category] - REVIEW_ORDER[b.category] ||
  a.detectedDay - b.detectedDay ||
  a.id.localeCompare(b.id);

/**
 * Returns copies with the shown `day` set, ascending by day. The incoming `day` is the earliest
 * day the alert may be shown (its detection day, or later if it was held for grouping).
 */
export function applyBudget(alerts: readonly Alert[], budgetPerDay: number): Alert[] {
  const shownDay = new Map<string, number>();
  const used = new Map<string, number>();
  const key = (day: number, crew: CrewId): string => `${day}:${crew}`;
  const pending: Alert[] = [];
  for (const a of alerts) {
    if (a.category === 'environmental_event') shownDay.set(a.id, a.day);
    else pending.push(a);
  }
  pending.sort(byReviewOrder);
  for (let day = 1; day <= MISSION_DAYS && pending.length > 0; day++) {
    for (let i = 0; i < pending.length; ) {
      const a = pending[i];
      if (a === undefined) break;
      const ready =
        a.day <= day && a.affected.every((c) => (used.get(key(day, c)) ?? 0) < budgetPerDay);
      if (!ready) {
        i++;
        continue;
      }
      for (const c of a.affected) used.set(key(day, c), (used.get(key(day, c)) ?? 0) + 1);
      shownDay.set(a.id, day);
      pending.splice(i, 1);
    }
  }
  const shown = alerts.map((a) => ({ ...a, day: shownDay.get(a.id) ?? NOT_SHOWN_DAY }));
  return shown.sort(
    (a, b) => a.day - b.day || a.detectedDay - b.detectedDay || a.id.localeCompare(b.id),
  );
}
