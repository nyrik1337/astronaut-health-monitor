import {
  absentItem,
  addDetail,
  checkModeClock,
  checkNotTooLate,
  echoNotices,
  evaluateObservation,
  evidenceSourceAllowed,
  parseTimestamp,
  validateNotices,
  validateObservation,
  validationError,
  isoZ,
  type Details,
} from './mockShared';
import { DEMO_POLICY, type EvidenceItem, type EvidenceKind, type EvidenceRequest, type EvidenceResponse, type NextCheck } from './types';

/** MOCK of POST /api/evidence/assess following the contract rules. Throws ApiError (422) on invalid input. */

const KINDS: readonly EvidenceKind[] = ['heart_rate', 'sleep_duration', 'cognitive_test'];
const NAMES: Record<EvidenceKind, string> = {
  heart_rate: 'heart-rate',
  sleep_duration: 'sleep duration',
  cognitive_test: 'reaction-time',
};

function validate(req: EvidenceRequest, receiptMs: number): number {
  const details: Details = [];
  const asOfMs = parseTimestamp(details, 'as_of', req.as_of);
  checkModeClock(details, req.mode, req.clock, asOfMs, receiptMs);
  const issueMs = parseTimestamp(details, 'reported_issue.reported_at', req.reported_issue.reported_at);
  checkNotTooLate(details, 'reported_issue.reported_at', issueMs, asOfMs);
  if (!evidenceSourceAllowed(req.mode, req.reported_issue.source.kind)) {
    addDetail(details, 'reported_issue.source.kind', 'PROVENANCE_MODE_MISMATCH', 'Source is not allowed in this mode.');
  }
  if (req.observations.length > 3) addDetail(details, 'observations', 'LIMIT_EXCEEDED', 'At most 3 observations.');
  const seen = new Set<EvidenceKind>();
  req.observations.forEach((o, i) => {
    if (seen.has(o.kind)) addDetail(details, `observations.${i}.kind`, 'DUPLICATE_OBSERVATION', 'Each kind at most once.');
    seen.add(o.kind);
    validateObservation(details, o, `observations.${i}`, req.mode, asOfMs);
  });
  validateNotices(details, req.notices, req.mode, asOfMs);
  if (details.length > 0 || asOfMs === null) throw validationError(details);
  return asOfMs;
}

function describe(item: EvidenceItem, synthetic: boolean): string | null {
  if (item.value === null || item.age_seconds === null) return null;
  const prefix = synthetic ? 'The synthetic' : 'The supplied';
  const age = `${item.age_seconds} seconds old`;
  switch (item.kind) {
    case 'heart_rate':
      return `${prefix} heart-rate observation is ${item.value} bpm and ${age}.`;
    case 'sleep_duration':
      return `${prefix} sleep duration is ${item.value} hours over the preceding 24 hours and ${age}.`;
    case 'cognitive_test':
      return `${prefix} reaction-time summary has a median of ${item.value} ms and is ${age}.`;
  }
}

function unknownsFor(items: readonly EvidenceItem[]): string[] {
  const out: string[] = [];
  const missing = items.filter((i) => i.status === 'missing_data').map((i) => NAMES[i.kind]);
  if (missing.length > 0) out.push(`Recent ${missing.join(' and ')} evidence is missing.`);
  for (const i of items) {
    if (i.issues.includes('stale_data')) out.push(`The ${NAMES[i.kind]} evidence is older than its freshness limit.`);
    if (i.issues.includes('poor_quality')) out.push(`The ${NAMES[i.kind]} evidence was reported as poor quality.`);
    if (i.issues.includes('quality_unknown')) out.push(`The ${NAMES[i.kind]} acquisition quality is unknown.`);
  }
  return out;
}

export function assessEvidenceMock(req: EvidenceRequest, receiptMs: number): EvidenceResponse {
  const asOfMs = validate(req, receiptMs);
  const synthetic = req.mode === 'simulation';
  const evidence = KINDS.map((kind) => {
    const o = req.observations.find((x) => x.kind === kind);
    return o ? evaluateObservation(o, asOfMs) : absentItem(kind);
  });
  const nonAvailable = [...new Set(evidence.map((e) => e.status).filter((s) => s !== 'available'))];
  const assessment_status =
    nonAvailable.length === 0 ? 'complete' : nonAvailable.length === 1 ? (nonAvailable[0] ?? 'mixed') : 'mixed';
  const unavailable = (kind: EvidenceKind) => evidence.find((e) => e.kind === kind)?.status !== 'available';
  const next_checks: NextCheck[] = [];
  if (unavailable('sleep_duration')) next_checks.push({ code: 'sleep_check_in', optional: true });
  if (unavailable('cognitive_test')) next_checks.push({ code: 'reaction_time_check', optional: true });
  const limitations = [
    ...(synthetic ? ['Synthetic demonstration only.'] : ['Evidence is client-reported and not authenticated device data.']),
    'Heart rate alone cannot explain reported fatigue. This inventory is not a diagnosis.',
  ];
  if (!unavailable('cognitive_test')) {
    limitations.push('A reaction-time summary is not proof of a valid longitudinal baseline.');
  }
  if (req.notices.length > 0) limitations.push('Notices are unverified client input.');
  return {
    subject_id: req.subject_id,
    mode: req.mode,
    clock: req.clock,
    as_of: isoZ(asOfMs),
    interpretation: synthetic ? 'synthetic_demonstration' : 'evidence_inventory',
    policy: DEMO_POLICY,
    assessment_status,
    evidence,
    what_data_show: evidence.map((e) => describe(e, synthetic)).filter((s): s is string => s !== null),
    unknowns: unknownsFor(evidence),
    limitations,
    next_checks,
    notices: echoNotices(req.notices),
  };
}
