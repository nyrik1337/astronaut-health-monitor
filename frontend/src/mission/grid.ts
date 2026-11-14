/**
 * SYNTHETIC MISSION SIMULATION — per-day grid of cell states.
 *
 * One state per day × crew member × domain: baseline building (days 1–30), no data, or a
 * descriptive signal category. Uses the detector score of that day plus alerts already known on
 * that day (review flags, open groups).
 */
import { CREW_IDS, DOMAIN_IDS, MISSION_DAYS } from './types';
import type { Alert, CellState, CrewId, DomainId, SeriesAnalysis } from './types';
import { cellState } from './signals';

const key = (day: number, crew: CrewId, domain: DomainId): string => `${day}:${crew}:${domain}`;

/** Marks days [from, until) for the given crew and domain. */
function mark(
  target: Set<string>,
  from: number,
  until: number | null,
  crew: readonly CrewId[],
  domain: DomainId,
): void {
  const end = Math.min(until ?? MISSION_DAYS + 1, MISSION_DAYS + 1);
  for (let day = from; day < end; day++) for (const c of crew) target.add(key(day, c, domain));
}

export function buildGrid(
  analysis: Record<CrewId, Record<DomainId, SeriesAnalysis>>,
  alerts: readonly Alert[],
): CellState[][][] {
  const flagged = new Set<string>();
  const grouped = new Set<string>();
  for (const a of alerts) {
    if (a.reviewFlaggedDay !== null) mark(flagged, a.reviewFlaggedDay, a.closedDay, a.affected, a.domain);
    if (a.kind === 'group') mark(grouped, a.detectedDay, a.closedDay, a.affected, a.domain);
  }
  return Array.from({ length: MISSION_DAYS }, (_, i) =>
    CREW_IDS.map((crew) =>
      DOMAIN_IDS.map((domain) =>
        cellState(i + 1, analysis[crew][domain].score[i] ?? null, {
          flaggedForReview: flagged.has(key(i + 1, crew, domain)),
          inGroup: grouped.has(key(i + 1, crew, domain)),
        }),
      ),
    ),
  );
}
