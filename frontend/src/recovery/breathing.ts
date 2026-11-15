/**
 * Relaxed-breathing pacing for MindGuard. Only two phases exist — a comfortable inhale and a longer,
 * gentle exhale — with no breath-hold, no fast breathing and no tolerance or hypoxia training.
 * Pure functions of elapsed time so the practice can be tested without real timers.
 */

export const INHALE_MS = 4_000;
export const EXHALE_MS = 6_000;
export const CYCLE_MS = INHALE_MS + EXHALE_MS;

/** Allowed practice lengths: 60 or 90 seconds. */
export const PRACTICE_DURATIONS_MS = [60_000, 90_000] as const;
export type PracticeDurationMs = (typeof PRACTICE_DURATIONS_MS)[number];

export type BreathPhase = 'inhale' | 'exhale';

export interface BreathingFrame {
  readonly phase: BreathPhase | 'done';
  /** Whole seconds left in the current inhale or exhale (0 when done). */
  readonly phaseSecondsLeft: number;
  /** Whole seconds left in the practice. */
  readonly remainingSeconds: number;
  /** Completed breaths (one inhale + one exhale). */
  readonly breaths: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export function breathingFrame(elapsedMs: number, durationMs: PracticeDurationMs): BreathingFrame {
  const elapsed = clamp(elapsedMs, 0, durationMs);
  const remainingSeconds = Math.ceil((durationMs - elapsed) / 1000);
  const breaths = Math.floor(elapsed / CYCLE_MS);
  if (elapsed >= durationMs) return { phase: 'done', phaseSecondsLeft: 0, remainingSeconds: 0, breaths };
  const inCycle = elapsed % CYCLE_MS;
  const phase: BreathPhase = inCycle < INHALE_MS ? 'inhale' : 'exhale';
  const phaseEnd = phase === 'inhale' ? INHALE_MS : CYCLE_MS;
  return { phase, phaseSecondsLeft: Math.ceil((phaseEnd - inCycle) / 1000), remainingSeconds, breaths };
}

export const isPracticeDuration = (value: number): value is PracticeDurationMs =>
  (PRACTICE_DURATIONS_MS as readonly number[]).includes(value);
