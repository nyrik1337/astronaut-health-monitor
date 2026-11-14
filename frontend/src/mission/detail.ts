/**
 * SYNTHETIC MISSION SIMULATION — measurement details for one cell on one day.
 *
 * Returns only what is known on that day: values of days 1..day and that day's detector state.
 * The personal baseline is withheld until day 31, because during days 1–30 it would include
 * values from later days of the baseline period.
 */
import { BASELINE_DAYS, CREW_IDS, DOMAIN_IDS, EVALUATION_START_DAY, MISSION_DAYS } from './types';
import type { CellDetail, CrewId, DomainId, Mission } from './types';
import { clampDay } from './guards';

export function cellDetail(
  mission: Mission,
  crew: CrewId,
  domain: DomainId,
  dayIn: number,
): CellDetail {
  const day = clampDay(dayIn, MISSION_DAYS);
  const i = day - 1;
  const a = mission.analysis[crew][domain];
  const values = mission.generated.values[crew][domain].slice(0, day);
  const row = mission.grid[i]?.[CREW_IDS.indexOf(crew)];
  return {
    synthetic: true,
    crew,
    domain,
    day,
    state: row?.[DOMAIN_IDS.indexOf(domain)] ?? 'no_data',
    values,
    baseline: day >= EVALUATION_START_DAY ? a.baseline : null,
    baselineDaysCollected: Math.min(day, BASELINE_DAYS),
    value: values[i] ?? null,
    z: a.z[i] ?? null,
    ewma: a.ewma[i] ?? null,
    cusumHi: a.cusumHi[i] ?? null,
    cusumLo: a.cusumLo[i] ?? null,
  };
}
