/**
 * SYNTHETIC MISSION SIMULATION — scripted scenarios.
 *
 * When and how the generator adds signal to the noise. The detectors never read this list; it is
 * used only by the generator and as ground truth for the false-alarm counter.
 */
import type { CrewId, DomainId, ScenarioEvent } from './types';

export const SCENARIO_EVENTS: readonly ScenarioEvent[] = [
  { id: 'sleep-drift-b', markerDay: 40, startDay: 40, endDay: 100, crew: ['B'], domain: 'sleep' },
  {
    id: 'module-co2',
    markerDay: 120,
    startDay: 120,
    endDay: 128,
    crew: ['A', 'C', 'D'],
    domain: 'sleep',
  },
  { id: 'hr-artifact', markerDay: 210, startDay: 210, endDay: 210, crew: ['A'], domain: 'cardio' },
  {
    id: 'solar-storm',
    markerDay: 300,
    startDay: 300,
    endDay: 302,
    crew: ['A', 'B', 'C', 'D'],
    domain: 'radiation',
  },
  {
    id: 'return-to-range-c',
    markerDay: 380,
    startDay: 355,
    endDay: 384,
    crew: ['C'],
    domain: 'sleep',
  },
];

/** B sleep shift in noise sigmas: down to −2.5σ over 40 days, back to baseline by day 100. */
function sleepDriftB(day: number): number {
  if (day < 40 || day > 100) return 0;
  return day <= 80 ? (-2.5 * (day - 40)) / 40 : (-2.5 * (100 - day)) / 20;
}

/** Simultaneous sleep shift for A, C and D during the scripted CO₂ rise (9 days). */
function moduleSleep(day: number): number {
  return day >= 120 && day <= 128 ? -3.5 : 0;
}

/** C sleep: slow dip from day 355, scripted return to baseline by days 378–380. */
function sleepDipC(day: number): number {
  if (day < 355 || day > 380) return 0;
  if (day <= 376) return -0.07 * (day - 354);
  return (-1.65 * (380 - day)) / 4;
}

/** Shift of a value in personal noise sigmas for (crew, domain, day). */
export function sigmaShift(crew: CrewId, domain: DomainId, day: number): number {
  if (domain === 'cardio') return crew === 'A' && day === 210 ? 6 : 0;
  if (domain !== 'sleep') return 0;
  if (crew === 'B') return sleepDriftB(day);
  if (crew === 'C') return moduleSleep(day) + sleepDipC(day);
  return moduleSleep(day);
}

const PARTICLE_EVENT_DOSE_MSV: Record<number, number> = { 300: 30, 301: 55, 302: 20 };
const SHIELDING: Record<CrewId, number> = { A: 1, B: 0.94, C: 1.06, D: 1 };

/** Extra daily dose from the scripted particle event, mSv (synthetic). */
export function particleEventDoseMSv(crew: CrewId, day: number): number {
  return (PARTICLE_EVENT_DOSE_MSV[day] ?? 0) * SHIELDING[crew];
}

/** Scripted CO₂ rise in the module (same arbitrary units as the series). */
export function co2Rise(day: number): number {
  return day >= 120 && day <= 128 ? 0.9 : 0;
}
