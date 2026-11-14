import { describe, expect, test } from 'vitest';
import { detectPlatform } from './browserContext';
import { EMPTY_REAL_STORE, historyBefore, isValidParticipantId, loadRealStore, nextPhase, saveRealStore, withSession, withoutParticipant } from './realStore';
import { MISSION_CLOCK, missionTime, syntheticCurrent, syntheticEvidenceRequest, syntheticHistory } from './syntheticStore';

describe('browser context', () => {
  test('reads Chrome on macOS with the fixed user-agent convention', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.108 Safari/537.36';
    expect(detectPlatform(ua)).toEqual({ ok: true, platform: { browser_family: 'chrome', browser_version: '131.0.6778.108', os_family: 'macos', os_version: '10.15.7' } });
  });

  test('recognises Edge, Firefox and Safari; rejects mobile and Linux without a version', () => {
    expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.70')).toMatchObject({ ok: true, platform: { browser_family: 'edge', os_family: 'windows', os_version: '10.0' } });
    expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0; rv:133.0) Gecko/20100101 Firefox/133.0')).toMatchObject({ ok: true, platform: { browser_family: 'firefox' } });
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.1 Safari/605.1.15')).toMatchObject({ ok: true, platform: { browser_family: 'safari', browser_version: '18.1' } });
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Version/18.1 Mobile Safari/604.1').ok).toBe(false);
    expect(detectPlatform('Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0.0.0 Safari/537.36').ok).toBe(false);
  });
});

describe('real participant store', () => {
  const session = syntheticCurrent('A', 50);

  test('keeps sessions per participant, ordered and bounded, and round-trips through storage', () => {
    const store = withSession(withSession(EMPTY_REAL_STORE, 'p-1', syntheticHistory('A', 50)[1]!), 'p-1', syntheticHistory('A', 50)[0]!);
    expect(store.participants['p-1']?.map((s) => s.session_id)).toEqual(syntheticHistory('A', 50).slice(0, 2).map((s) => s.session_id));
    const memory = new Map<string, string>();
    const storage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => void memory.set(k, v) } as unknown as Storage;
    saveRealStore(store, storage);
    expect(loadRealStore(storage)).toEqual(store);
    expect(withoutParticipant(store, 'p-1').participants).toEqual({});
  });

  test('history ends strictly before the current start; phase is familiarization until two usable ones', () => {
    const history = syntheticHistory('A', 50);
    expect(historyBefore([...history, session], Date.parse(session.started_at))).toHaveLength(5);
    expect(nextPhase([], 'synthetic-setup-1')).toBe('familiarization');
    expect(nextPhase(history.slice(0, 1), 'synthetic-setup-1')).toBe('familiarization');
    expect(nextPhase(history.slice(0, 2), 'synthetic-setup-1')).toBe('measurement');
    expect(nextPhase(history.slice(0, 2), 'other-setup')).toBe('familiarization');
  });

  test('participant IDs are opaque and bounded', () => {
    expect(isValidParticipantId('participant-01')).toBe(true);
    expect(isValidParticipantId('')).toBe(false);
    expect(isValidParticipantId('Jane Doe')).toBe(false);
  });
});

describe('synthetic store', () => {
  test('uses the mission clock and simulated provenance only', () => {
    const request = syntheticEvidenceRequest({ crew: 'B', day: 70, heartRate: 58, sleepHours: 6.4, reactionMedianMs: 370 });
    expect(request.clock).toEqual(MISSION_CLOCK);
    expect(request.mode).toBe('simulation');
    expect([request.reported_issue.source, ...request.observations.map((o) => o.source)].every((s) => s.kind === 'simulated')).toBe(true);
    expect(request.as_of).toBe(missionTime(70, 10));
    expect([...syntheticHistory('B', 70), syntheticCurrent('B', 70)].every((s) => s.source.kind === 'simulated' && s.clock.kind === 'mission')).toBe(true);
  });
});
