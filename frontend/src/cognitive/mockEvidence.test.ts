import { describe, expect, test } from 'vitest';
import { ApiError } from '../api/errors';
import { assessEvidenceMock } from './mockEvidence';
import type { EvidenceRequest } from './types';

/** Contract example and rules for the frontend MOCK of POST /api/evidence/assess. */

const sim = { kind: 'simulated', source_id: 'mission-500' } as const;
const example: EvidenceRequest = {
  subject_id: 'sim-crew-01',
  mode: 'simulation',
  clock: { kind: 'mission', id: 'mission-500' },
  as_of: '2026-11-14T10:00:00Z',
  reported_issue: { code: 'fatigue', reported_at: '2026-11-14T09:58:00Z', source: sim },
  observations: [
    { kind: 'heart_rate', observed_at: '2026-11-14T09:55:00Z', value: 72, source: sim, quality: { status: 'unknown', reasons: [] } },
  ],
  notices: [],
};
const WALL = Date.parse('1999-01-01T00:00:00Z');

describe('evidence mock (contract rules)', () => {
  test('reproduces the contract example', () => {
    const r = assessEvidenceMock(example, WALL);
    expect(r.assessment_status).toBe('missing_data');
    expect(r.interpretation).toBe('synthetic_demonstration');
    expect(r.evidence.map((e) => e.kind)).toEqual(['heart_rate', 'sleep_duration', 'cognitive_test']);
    expect(r.evidence[0]).toMatchObject({ status: 'available', value: 72, age_seconds: 300, issues: ['quality_unknown'] });
    expect(r.evidence[1]).toEqual({ kind: 'sleep_duration', status: 'missing_data', observed_at: null, value: null, source: null, quality: null, age_seconds: null, issues: ['missing_data'] });
    expect(r.next_checks).toEqual([{ code: 'sleep_check_in', optional: true }, { code: 'reaction_time_check', optional: true }]);
    expect(r.limitations).toContain('Heart rate alone cannot explain reported fatigue. This inventory is not a diagnosis.');
    expect(r.limitations).toContain('Synthetic demonstration only.');
  });

  test('stale is strictly greater than the limit; complete removes the checks', () => {
    const observations: EvidenceRequest['observations'] = [
      { kind: 'heart_rate', observed_at: '2026-11-14T09:45:00Z', value: 72, source: sim, quality: { status: 'acceptable', reasons: [] } },
      { kind: 'sleep_duration', observed_at: '2026-11-13T07:00:00Z', value: 6.5, source: sim, quality: { status: 'acceptable', reasons: [] } },
      { kind: 'cognitive_test', observed_at: '2026-11-14T09:00:00Z', value: 370, source: sim, quality: { status: 'acceptable', reasons: [] } },
    ];
    const r = assessEvidenceMock({ ...example, observations }, WALL);
    expect(r.evidence.map((e) => e.status)).toEqual(['available', 'available', 'available']);
    expect(r.assessment_status).toBe('complete');
    expect(r.next_checks).toEqual([]);
    const stale = assessEvidenceMock({ ...example, observations: [{ ...observations[0]!, observed_at: '2026-11-14T09:44:59Z' }] }, WALL);
    expect(stale.evidence[0]?.status).toBe('stale_data');
    expect(stale.assessment_status).toBe('mixed');
  });

  test('echoes notices as unverified and keeps missing values missing', () => {
    const r = assessEvidenceMock(
      {
        ...example,
        observations: [{ kind: 'sleep_duration', observed_at: '2026-11-14T07:00:00Z', value: null, source: sim, quality: { status: 'poor', reasons: ['strap loose'] } }],
        notices: [{ id: 'n1', reported_at: '2026-11-14T09:59:00Z', source: sim, text: 'Crew reports headache.' }],
      },
      WALL,
    );
    expect(r.evidence[1]).toMatchObject({ status: 'missing_data', value: null, issues: ['missing_data', 'poor_quality'] });
    expect(r.notices).toEqual([{ id: 'n1', reported_at: '2026-11-14T09:59:00Z', source: sim, text: 'Crew reports headache.', verification: 'unverified_client_input' }]);
  });

  test('rejects future evidence, wrong provenance and duplicate kinds', () => {
    const codes = (request: EvidenceRequest, wall = WALL): string[] => {
      try {
        assessEvidenceMock(request, wall);
        return [];
      } catch (e) {
        return (e as ApiError).details.map((d) => d.code);
      }
    };
    const hr = example.observations[0]!;
    expect(codes({ ...example, observations: [{ ...hr, observed_at: '2026-11-14T10:00:01Z' }] })).toContain('FUTURE_OBSERVATION');
    expect(codes({ ...example, observations: [{ ...hr, source: { kind: 'real_device', source_id: null } }] })).toContain('PROVENANCE_MODE_MISMATCH');
    expect(codes({ ...example, observations: [hr, hr] })).toContain('DUPLICATE_OBSERVATION');
    expect(codes({ ...example, mode: 'real_assessment' })).toContain('CLOCK_MISMATCH');
  });
});
