/**
 * SYNTHETIC MISSION SIMULATION — data generator.
 *
 * 4 synthetic crew members × 6 domains × 500 days, each with an own level and noise; scripted
 * scenarios are added from scenarios.ts. Everything comes from one seed. None of the values are
 * measurements of a real person, and the level ranges are not clinical reference ranges.
 */
import { BASELINE_DAYS, CREW_IDS, DOMAIN_IDS, MAD_SCALE, MISSION_DAYS } from './types';
import type { CrewId, CrewSeries, DomainId, GeneratedMission } from './types';
import { mad, median } from './detect';
import { at } from './guards';
import { mulberry32, normal } from './rng';
import { SCENARIO_EVENTS, co2Rise, particleEventDoseMSv, sigmaShift } from './scenarios';

/** Noise is clipped: scripted scenarios, not random tails, create the large deviations. */
export const NOISE_CLAMP = 2.1;

interface Profile {
  base: readonly [number, number];
  noise: readonly [number, number];
}

/** Ranges for each synthetic member's level and noise, per domain (arbitrary demo units). */
const PROFILES: Record<DomainId, Profile> = {
  cardio: { base: [52, 64], noise: [1.4, 2.2] },
  musculo: { base: [96, 104], noise: [3, 5] },
  behavior: { base: [250, 300], noise: [6, 10] },
  sleep: { base: [6.6, 7.6], noise: [0.22, 0.34] },
  immune: { base: [96, 104], noise: [3, 5] },
  radiation: { base: [0.5, 0.8], noise: [0.03, 0.06] },
};

const CO2_BASE = 3;
const CO2_NOISE = 0.06;
const NOISE_DB_BASE = 45;
const NOISE_DB_NOISE = 0.8;

const between = (rand: () => number, [lo, hi]: readonly [number, number]): number =>
  lo + (hi - lo) * rand();

const clampedNoise = (rand: () => number): number =>
  Math.max(-NOISE_CLAMP, Math.min(NOISE_CLAMP, normal(rand)));

/**
 * Data generation, not analysis: the synthetic noise of days 1–30 is rescaled to median 0 and
 * robust spread 1 so the scripted scenarios are measured against a known baseline. The detectors
 * still estimate the baseline themselves from days 1–30 only.
 */
function noiseSeries(rand: () => number): number[] {
  const raw = Array.from({ length: MISSION_DAYS }, () => normal(rand));
  const head = raw.slice(0, BASELINE_DAYS);
  const centre = median(head);
  const spread = mad(head) * MAD_SCALE;
  return raw.map((n, i) => {
    const v = i < BASELINE_DAYS && spread > 0 ? (n - centre) / spread : n;
    return Math.max(-NOISE_CLAMP, Math.min(NOISE_CLAMP, v));
  });
}

function generateSeries(rand: () => number, crew: CrewId, domain: DomainId): number[] {
  const profile = PROFILES[domain];
  const base = between(rand, profile.base);
  const sigma = between(rand, profile.noise);
  const noise = noiseSeries(rand);
  const out: number[] = [];
  for (let day = 1; day <= MISSION_DAYS; day++) {
    let value = base + sigma * (at(noise, day - 1) + sigmaShift(crew, domain, day));
    if (domain === 'radiation') value += particleEventDoseMSv(crew, day);
    out.push(value);
  }
  return out;
}

function generateEnv(rand: () => number): GeneratedMission['env'] {
  const co2: number[] = [];
  const noise: number[] = [];
  for (let day = 1; day <= MISSION_DAYS; day++) {
    co2.push(CO2_BASE + CO2_NOISE * clampedNoise(rand) + co2Rise(day));
    noise.push(NOISE_DB_BASE + NOISE_DB_NOISE * clampedNoise(rand));
  }
  return { co2, noise };
}

export function generateMission(seed: number): GeneratedMission {
  const rand = mulberry32(seed);
  const values = {} as CrewSeries;
  for (const crew of CREW_IDS) {
    const byDomain = {} as CrewSeries[CrewId];
    for (const domain of DOMAIN_IDS) byDomain[domain] = generateSeries(rand, crew, domain);
    values[crew] = byDomain;
  }
  const env = generateEnv(rand);
  return {
    synthetic: true,
    seed,
    values,
    env,
    events: SCENARIO_EVENTS.map((e) => ({ ...e, crew: [...e.crew] })),
  };
}
