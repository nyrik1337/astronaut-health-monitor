import { isoZ } from './mockShared';
import type { Clock, CrewId } from './syntheticTypes';
import type { EvidenceRequest, Observation, Session, SessionContext, Trial } from './types';

/**
 * SYNTHETIC mission subjects for the Evidence Navigator / CognitiveGuard demonstration. Everything
 * uses the mission clock and `simulated` provenance and is generated deterministically. It never
 * reads or writes the real-participant store.
 */

export const MISSION_CLOCK: Clock = { kind: 'mission', id: 'orbita-mission-seed-2026' };
const MISSION_EPOCH_MS = Date.UTC(2026, 0, 1);
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/** Mission day d (1-based) at hh:mm on the mission clock, as an RFC 3339 instant. */
export const missionTime = (day: number, hour: number, minute = 0): string =>
  isoZ(MISSION_EPOCH_MS + (day - 1) * DAY_MS + hour * HOUR_MS + minute * MINUTE_MS);

export const syntheticSubjectId = (crew: CrewId): string => `sim-crew-${crew}`;
const SIM_SOURCE = { kind: 'simulated', source_id: MISSION_CLOCK.id } as const;

export const SYNTHETIC_CONTEXT: SessionContext = {
  setup_id: 'synthetic-setup-1',
  device_class: 'laptop',
  browser_family: 'chrome',
  browser_version: '131.0.6778.108',
  os_family: 'macos',
  os_version: '15.1.1',
  input_method: 'keyboard_space',
  timing_api: 'performance_now',
};

/** Symmetric offsets: the median of median + offsets is exactly `median`. */
const OFFSETS = [-45, -40, -35, -30, -25, -20, -15, -10, -5, 0, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45];

function syntheticTrials(median: number): Trial[] {
  return OFFSETS.map((offset, i) => ({
    index: i + 1,
    wait_ms: 1000 + ((i * 137) % 2001),
    outcome: 'response',
    reaction_time_ms: median + offset,
  }));
}

function syntheticSession(
  crew: CrewId,
  id: string,
  phase: Session['phase'],
  day: number,
  hour: number,
  median: number,
): Session {
  const ended = missionTime(day, hour, 1);
  return {
    session_id: `${syntheticSubjectId(crew)}-${id}`,
    subject_id: syntheticSubjectId(crew),
    clock: MISSION_CLOCK,
    test_version: 'orbita-rt-1',
    phase,
    started_at: missionTime(day, hour),
    ended_at: ended,
    source: SIM_SOURCE,
    context: SYNTHETIC_CONTEXT,
    completion: 'completed',
    interruptions: [],
    trials: syntheticTrials(median),
  };
}

/** Two familiarization and three measurement sessions (medians 310, 320, 330 ms) before `day`. */
export function syntheticHistory(crew: CrewId, day: number): Session[] {
  return [
    syntheticSession(crew, `fam-1-d${day - 9}`, 'familiarization', day - 9, 9, 340),
    syntheticSession(crew, `fam-2-d${day - 8}`, 'familiarization', day - 8, 9, 335),
    syntheticSession(crew, `meas-1-d${day - 6}`, 'measurement', day - 6, 9, 310),
    syntheticSession(crew, `meas-2-d${day - 4}`, 'measurement', day - 4, 9, 320),
    syntheticSession(crew, `meas-3-d${day - 2}`, 'measurement', day - 2, 9, 330),
  ];
}

/** The separately labelled synthetic reassessment check on `day` (median 370 ms). */
export const syntheticCurrent = (crew: CrewId, day: number): Session =>
  syntheticSession(crew, `current-d${day}`, 'measurement', day, 9, 370);

export const syntheticAsOf = (day: number): string => missionTime(day, 10);

export interface SyntheticEvidenceInput {
  readonly crew: CrewId;
  readonly day: number;
  /** synthetic resting heart rate for the day, bpm */
  readonly heartRate: number | null;
  /** synthetic sleep check-in, hours (null = not yet checked in) */
  readonly sleepHours: number | null;
  /** median of a synthetic CognitiveGuard result (null = no reaction check yet) */
  readonly reactionMedianMs: number | null;
}

export function syntheticEvidenceRequest(input: SyntheticEvidenceInput): EvidenceRequest {
  const { crew, day } = input;
  const unknownQuality: Observation['quality'] = { status: 'unknown', reasons: [] };
  const observations: Observation[] = [];
  if (input.heartRate !== null) {
    observations.push({ kind: 'heart_rate', observed_at: missionTime(day, 9, 55), value: input.heartRate, source: SIM_SOURCE, quality: unknownQuality });
  }
  if (input.sleepHours !== null) {
    observations.push({ kind: 'sleep_duration', observed_at: missionTime(day, 7), value: input.sleepHours, source: SIM_SOURCE, quality: unknownQuality });
  }
  if (input.reactionMedianMs !== null) {
    observations.push({ kind: 'cognitive_test', observed_at: missionTime(day, 9, 1), value: input.reactionMedianMs, source: SIM_SOURCE, quality: unknownQuality });
  }
  return {
    subject_id: syntheticSubjectId(crew),
    mode: 'simulation',
    clock: MISSION_CLOCK,
    as_of: syntheticAsOf(day),
    reported_issue: { code: 'fatigue', reported_at: missionTime(day, 9, 58), source: SIM_SOURCE },
    observations,
    notices: [],
  };
}
