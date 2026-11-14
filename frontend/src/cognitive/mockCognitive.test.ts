import { describe, expect, test } from 'vitest';
import { ApiError } from '../api/errors';
import { analyzeCognitiveMock } from './mockCognitive';
import { MISSION_CLOCK, syntheticAsOf, syntheticCurrent, syntheticHistory, syntheticSubjectId } from './syntheticStore';
import type { CognitiveRequest, Session, Trial } from './types';

/** The contract's acceptance fixtures, run against the frontend MOCK of POST /api/cognitive/analyze. */

const RECEIPT = Date.parse('2026-11-14T10:05:00Z');
const trials = (rt: number, n = 20): Trial[] =>
  Array.from({ length: n }, (_, i) => ({ index: i + 1, wait_ms: 2000, outcome: 'response', reaction_time_ms: rt }));

const realSession = (overrides: Partial<Session> = {}): Session => ({
  session_id: 'real-001',
  subject_id: 'participant-01',
  clock: { kind: 'utc', id: 'utc' },
  test_version: 'orbita-rt-1',
  phase: 'measurement',
  started_at: '2026-11-14T10:03:00Z',
  ended_at: '2026-11-14T10:04:00Z',
  source: { kind: 'browser_measured', source_id: null },
  context: {
    setup_id: 'setup-a', device_class: 'laptop', browser_family: 'chrome', browser_version: '131.0.6778.108',
    os_family: 'macos', os_version: '15.1.1', input_method: 'keyboard_space', timing_api: 'performance_now',
  },
  completion: 'completed',
  interruptions: [],
  trials: trials(370),
  ...overrides,
});

const realRequest = (current: Session, history: Session[] = []): CognitiveRequest => ({
  subject_id: 'participant-01', mode: 'real_assessment', clock: { kind: 'utc', id: 'utc' },
  as_of: '2026-11-14T10:05:00Z', current_test: current, history, context_observations: [], notices: [],
});

const before = (iso: string, minutes: number) => new Date(Date.parse(iso) - minutes * 60_000).toISOString();
const histSession = (id: string, phase: Session['phase'], endIso: string, rt: number, extra: Partial<Session> = {}) =>
  realSession({ session_id: id, phase, started_at: before(endIso, 1), ended_at: endIso, trials: trials(rt), ...extra });

const fiveHistory = (): Session[] => [
  histSession('f1', 'familiarization', '2026-11-10T09:00:00Z', 340),
  histSession('f2', 'familiarization', '2026-11-11T09:00:00Z', 335),
  histSession('m1', 'measurement', '2026-11-12T09:00:00Z', 310),
  histSession('m2', 'measurement', '2026-11-13T09:00:00Z', 320),
  histSession('m3', 'measurement', '2026-11-14T09:00:00Z', 330),
];

function errorOf(run: () => unknown): ApiError | null {
  try {
    run();
    return null;
  } catch (e) {
    return e instanceof ApiError ? e : null;
  }
}

describe('cognitive mock (contract fixtures)', () => {
  test('first real measurement without history is insufficient_history', () => {
    const r = analyzeCognitiveMock(realRequest(realSession()), RECEIPT);
    expect(r.analysis_status).toBe('insufficient_history');
    expect(r.issues).toEqual(['insufficient_history']);
    expect(r.current).toEqual({ valid_trials: 20, missed_responses: 0, early_responses: 0, median_reaction_time_ms: 370, p90_reaction_time_ms: 370 });
    expect(r.baseline).toBeNull();
    expect(r.interpretation).toBe('experimental_personal_summary');
    expect(r.timestamp).toBe('2026-11-14T10:04:00Z');
    expect(r.next_checks).toEqual([{ code: 'collect_comparable_history', optional: true }]);
    expect(r.limitations.join(' ')).toContain('not a clinically validated PVT');
  });

  test('two familiarization + three measurements give baseline 320 and +50 ms', () => {
    const r = analyzeCognitiveMock(realRequest(realSession(), fiveHistory()), RECEIPT);
    expect(r.analysis_status).toBe('analyzed');
    expect(r.baseline).toEqual({ session_ids: ['m1', 'm2', 'm3'], median_reaction_time_ms: 320, signed_difference_ms: 50 });
    expect(r.history_evaluation.map((h) => h.disposition)).toEqual(['familiarization', 'familiarization', 'baseline', 'baseline', 'baseline']);
    expect(r.next_checks).toEqual([]);
  });

  test('the same fixture in simulation is a synthetic demonstration, independent of wall time', () => {
    const day = 70;
    const r = analyzeCognitiveMock(
      {
        subject_id: syntheticSubjectId('B'), mode: 'simulation', clock: MISSION_CLOCK, as_of: syntheticAsOf(day),
        current_test: syntheticCurrent('B', day), history: syntheticHistory('B', day), context_observations: [], notices: [],
      },
      Date.parse('2000-01-01T00:00:00Z'),
    );
    expect(r.interpretation).toBe('synthetic_demonstration');
    expect(r.baseline?.median_reaction_time_ms).toBe(320);
    expect(r.baseline?.signed_difference_ms).toBe(50);
    expect(r.limitations[0]).toBe('Synthetic demonstration only.');
  });

  test('excludes mismatched, poor and expired history and flags missing familiarization', () => {
    const misses = Array.from({ length: 5 }, (_, i): Trial => ({ index: 16 + i, wait_ms: 2000, outcome: 'missed', reaction_time_ms: null }));
    const history = [
      histSession('old', 'measurement', '2026-10-01T09:00:00Z', 300),
      histSession('ff', 'measurement', '2026-11-12T08:00:00Z', 300, { context: { ...realSession().context, browser_family: 'firefox' } }),
      histSession('poor', 'measurement', '2026-11-12T09:00:00Z', 300, { trials: [...trials(300, 15), ...misses] }),
      histSession('lone', 'measurement', '2026-11-13T09:00:00Z', 300),
    ];
    const r = analyzeCognitiveMock(realRequest(realSession(), history), RECEIPT);
    expect(r.history_evaluation.map((h) => h.reasons)).toEqual([
      ['history_expired'],
      ['context_mismatch'],
      ['poor_quality'],
      ['familiarization_incomplete'],
    ]);
    expect(r.analysis_status).toBe('insufficient_history');
  });

  test('patch versions match, a new major version does not', () => {
    const patch = fiveHistory().map((s) => ({ ...s, context: { ...s.context, browser_version: '131.0.6778.85' } }));
    expect(analyzeCognitiveMock(realRequest(realSession(), patch), RECEIPT).analysis_status).toBe('analyzed');
    const major = fiveHistory().map((s) => ({ ...s, context: { ...s.context, browser_version: '132.0.1' } }));
    const r = analyzeCognitiveMock(realRequest(realSession(), major), RECEIPT);
    expect(r.history_evaluation.every((h) => h.reasons.includes('context_mismatch'))).toBe(true);
  });

  test('status precedence: aborted current is poor_quality, zero valid responses is missing_data', () => {
    const aborted = realSession({ completion: 'aborted', interruptions: ['window_blur'], trials: trials(370, 8) });
    const poor = analyzeCognitiveMock(realRequest(aborted, fiveHistory()), RECEIPT);
    expect(poor.analysis_status).toBe('poor_quality');
    expect(poor.next_checks).toEqual([{ code: 'repeat_uninterrupted', optional: true }]);
    const none = realSession({ completion: 'aborted', interruptions: ['cancelled'], trials: [] });
    const missing = analyzeCognitiveMock(realRequest(none), RECEIPT);
    expect(missing.analysis_status).toBe('missing_data');
    expect(missing.current.median_reaction_time_ms).toBeNull();
    expect(missing.issues).toEqual(['missing_data', 'poor_quality', 'insufficient_history']);
  });

  test('a current familiarization session reports familiarization and insufficient_history', () => {
    const r = analyzeCognitiveMock(realRequest(realSession({ phase: 'familiarization' }), fiveHistory()), RECEIPT);
    expect(r.issues).toEqual(['familiarization', 'insufficient_history']);
  });

  test('rejects mixed provenance, future sessions and a far-off real as_of', () => {
    const synthetic = histSession('sim', 'measurement', '2026-11-13T09:00:00Z', 300, { source: { kind: 'simulated', source_id: 'x' } });
    const mixed = errorOf(() => analyzeCognitiveMock(realRequest(realSession(), [synthetic]), RECEIPT));
    expect(mixed?.status).toBe(422);
    expect(mixed?.details.map((d) => [d.field, d.code])).toContainEqual(['history.0.source.kind', 'PROVENANCE_MODE_MISMATCH']);
    const future = errorOf(() =>
      analyzeCognitiveMock({ ...realRequest(realSession()), as_of: '2026-11-14T10:03:30Z' }, Date.parse('2026-11-14T10:03:30Z')),
    );
    expect(future?.details.map((d) => d.code)).toContain('FUTURE_OBSERVATION');
    const late = errorOf(() => analyzeCognitiveMock(realRequest(realSession()), Date.parse('2026-11-14T10:20:00Z')));
    expect(late?.details.map((d) => d.code)).toContain('AS_OF_OUT_OF_RANGE');
  });
});
