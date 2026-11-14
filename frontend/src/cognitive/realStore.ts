import { usable } from './summary';
import type { Session, SessionContext } from './types';

/**
 * Store for REAL participants, kept apart from synthetic mission subjects (contract: distinct
 * subject/history stores). By default it lives in memory only; it is written to this browser's
 * localStorage only after the participant explicitly opts in, and can be cleared at any time.
 * Nothing here is ever mixed into a synthetic history.
 */

export const REAL_STORE_KEY = 'orbita.cognitive.real.v1';
export const MAX_HISTORY = 100;
const PARTICIPANT_ID = /^[A-Za-z0-9_-]{1,128}$/;

export interface RealSetup {
  readonly setup_id: string;
  readonly device_class: SessionContext['device_class'];
}

export interface RealStoreData {
  readonly version: 1;
  readonly setup: RealSetup | null;
  readonly participants: Readonly<Record<string, readonly Session[]>>;
}

export const EMPTY_REAL_STORE: RealStoreData = { version: 1, setup: null, participants: {} };

export const isValidParticipantId = (id: string): boolean => PARTICIPANT_ID.test(id);

/** A random identifier for this physical setup; rotate it when hardware or setup changes. */
export const newSetupId = (): string => `setup-${crypto.randomUUID()}`;

function isStore(value: unknown): value is RealStoreData {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { version?: unknown }).version === 1 &&
    typeof (value as { participants?: unknown }).participants === 'object'
  );
}

export function loadRealStore(storage: Storage | null = safeStorage()): RealStoreData {
  try {
    const raw = storage?.getItem(REAL_STORE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isStore(parsed) ? parsed : EMPTY_REAL_STORE;
  } catch {
    return EMPTY_REAL_STORE;
  }
}

export function saveRealStore(data: RealStoreData, storage: Storage | null = safeStorage()): void {
  try {
    storage?.setItem(REAL_STORE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be unavailable (private mode, quota); the session still works in memory.
  }
}

/** True when results were kept earlier with the participant's opt-in. */
export function hasSavedRealStore(storage: Storage | null = safeStorage()): boolean {
  try {
    return storage?.getItem(REAL_STORE_KEY) != null;
  } catch {
    return false;
  }
}

/** Removes every real-participant record from this browser's storage. */
export function clearRealStore(storage: Storage | null = safeStorage()): void {
  try {
    storage?.removeItem(REAL_STORE_KEY);
  } catch {
    // Nothing stored or storage unavailable: nothing to clear.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const withSetup = (data: RealStoreData, setup: RealSetup): RealStoreData => ({ ...data, setup });

/** Adds a session; history stays ordered by end time and bounded to the latest MAX_HISTORY. */
export function withSession(data: RealStoreData, participantId: string, session: Session): RealStoreData {
  const existing = data.participants[participantId] ?? [];
  const sessions = [...existing.filter((s) => s.session_id !== session.session_id), session]
    .sort((a, b) => Date.parse(a.ended_at) - Date.parse(b.ended_at))
    .slice(-MAX_HISTORY);
  return { ...data, participants: { ...data.participants, [participantId]: sessions } };
}

export function withoutParticipant(data: RealStoreData, participantId: string): RealStoreData {
  const participants = Object.fromEntries(
    Object.entries(data.participants).filter(([id]) => id !== participantId),
  );
  return { ...data, participants };
}

/** Raw sessions ending strictly before `startMs`, ordered, at most MAX_HISTORY. */
export function historyBefore(sessions: readonly Session[], startMs: number): Session[] {
  return sessions
    .filter((s) => Date.parse(s.ended_at) < startMs)
    .sort((a, b) => Date.parse(a.ended_at) - Date.parse(b.ended_at))
    .slice(-MAX_HISTORY);
}

/**
 * Phase for the next attempt: familiarization until two usable familiarization sessions exist on
 * this setup. The backend still decides eligibility; this only labels the attempt honestly.
 */
export function nextPhase(sessions: readonly Session[], setupId: string): Session['phase'] {
  const done = sessions.filter(
    (s) => s.phase === 'familiarization' && s.context.setup_id === setupId && usable(s),
  ).length;
  return done < 2 ? 'familiarization' : 'measurement';
}
