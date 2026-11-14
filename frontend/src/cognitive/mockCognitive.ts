import {
  addDetail,
  checkModeClock,
  echoNotices,
  evaluateObservation,
  isoZ,
  parseTimestamp,
  round3,
  validateNotices,
  validateObservation,
  validationError,
  type Details,
} from './mockShared';
import { sessionSummary, usable } from './summary';
import {
  DEMO_POLICY,
  type CognitiveRequest,
  type CognitiveResponse,
  type NextCheck,
  type Session,
} from './types';
import { validateSession } from './mockSessionRules';

/** MOCK of POST /api/cognitive/analyze following the contract rules. Throws ApiError (422) on invalid input. */

const HISTORY_WINDOW_MS = DEMO_POLICY.history_max_age_seconds * 1000;
const STALE_MS = DEMO_POLICY.freshness_seconds.cognitive_test * 1000;

const major = (version: string): number => Number.parseInt(version.split('.')[0] ?? '', 10);

export function sameContext(a: Session, b: Session): boolean {
  return (
    a.context.setup_id === b.context.setup_id &&
    a.context.device_class === b.context.device_class &&
    a.context.browser_family === b.context.browser_family &&
    a.context.os_family === b.context.os_family &&
    a.context.input_method === b.context.input_method &&
    a.context.timing_api === b.context.timing_api &&
    a.test_version === b.test_version &&
    major(a.context.browser_version) === major(b.context.browser_version) &&
    major(a.context.os_version) === major(b.context.os_version)
  );
}

function validate(req: CognitiveRequest, receiptMs: number): number {
  const details: Details = [];
  const asOfMs = parseTimestamp(details, 'as_of', req.as_of);
  checkModeClock(details, req.mode, req.clock, asOfMs, receiptMs);
  const currentStart = validateSession(details, req.current_test, 'current_test', req, asOfMs);
  if (req.history.length > 100) addDetail(details, 'history', 'LIMIT_EXCEEDED', 'At most 100 historical sessions.');
  const ids = new Set([req.current_test.session_id]);
  const ends = new Set([Date.parse(req.current_test.ended_at)]);
  let previousEnd = -Infinity;
  req.history.forEach((s, i) => {
    validateSession(details, s, `history.${i}`, req, asOfMs);
    const end = Date.parse(s.ended_at);
    if (ids.has(s.session_id)) addDetail(details, `history.${i}.session_id`, 'DUPLICATE_ID', 'Session IDs must be unique.');
    if (ends.has(end)) addDetail(details, `history.${i}.ended_at`, 'DUPLICATE_TIMESTAMP', 'Session end instants must be unique.');
    if (end <= previousEnd) addDetail(details, `history.${i}.ended_at`, 'TIMESTAMP_OUT_OF_ORDER', 'History must be ordered by end time.');
    if (currentStart !== null && end >= currentStart) {
      addDetail(details, `history.${i}.ended_at`, 'TIMESTAMP_NOT_BEFORE_CURRENT', 'History must end before the current session starts.');
    }
    ids.add(s.session_id);
    ends.add(end);
    previousEnd = end;
  });
  if (req.context_observations.length > 2) {
    addDetail(details, 'context_observations', 'LIMIT_EXCEEDED', 'At most 2 context observations.');
  }
  const kinds = new Set<string>();
  req.context_observations.forEach((o, i) => {
    if (o.kind === 'cognitive_test') addDetail(details, `context_observations.${i}.kind`, 'INVALID_VALUE', 'Only sleep and heart rate.');
    if (kinds.has(o.kind)) addDetail(details, `context_observations.${i}.kind`, 'DUPLICATE_OBSERVATION', 'Each kind at most once.');
    kinds.add(o.kind);
    validateObservation(details, o, `context_observations.${i}`, req.mode, asOfMs);
  });
  validateNotices(details, req.notices, req.mode, asOfMs);
  if (details.length > 0 || asOfMs === null) throw validationError(details);
  return asOfMs;
}

type Evaluation = CognitiveResponse['history_evaluation'][number];

/** Deterministic baseline selection (contract steps 1–4). */
function evaluateHistory(req: CognitiveRequest): { evaluation: Evaluation[]; baseline: Session[]; familiarization: number } {
  const current = req.current_test;
  const currentStart = Date.parse(current.started_at);
  const basic = req.history.map((s) => {
    const reasons: Evaluation['reasons'] = [];
    if (!sameContext(s, current)) reasons.push('context_mismatch');
    if (!usable(s)) reasons.push('poor_quality');
    if (currentStart - Date.parse(s.ended_at) > HISTORY_WINDOW_MS) reasons.push('history_expired');
    return { session: s, reasons };
  });
  const qualifyingFam = basic.filter((b) => b.reasons.length === 0 && b.session.phase === 'familiarization');
  const famBefore = (start: number) => qualifyingFam.filter((f) => Date.parse(f.session.ended_at) < start).length;
  const evaluation = basic.map(({ session, reasons }): Evaluation => {
    const all = [...reasons];
    if (session.phase === 'measurement' && reasons.length === 0 && famBefore(Date.parse(session.started_at)) < 2) {
      all.push('familiarization_incomplete');
    }
    const disposition = all.length > 0 ? 'excluded' : session.phase === 'familiarization' ? 'familiarization' : 'baseline';
    return { session_id: session.session_id, disposition, reasons: all };
  });
  const baseline = req.history.filter((_, i) => evaluation[i]?.disposition === 'baseline');
  return { evaluation, baseline, familiarization: famBefore(currentStart) };
}

const medianOf = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
};

const NEXT: Record<CognitiveResponse['analysis_status'], NextCheck[]> = {
  missing_data: [{ code: 'repeat_uninterrupted', optional: true }],
  poor_quality: [{ code: 'repeat_uninterrupted', optional: true }],
  stale_data: [{ code: 'reaction_time_check', optional: true }],
  insufficient_history: [{ code: 'collect_comparable_history', optional: true }],
  analyzed: [],
};

export function analyzeCognitiveMock(req: CognitiveRequest, receiptMs: number): CognitiveResponse {
  const asOfMs = validate(req, receiptMs);
  const synthetic = req.mode === 'simulation';
  const current = req.current_test;
  const summary = sessionSummary(current);
  const { evaluation, baseline, familiarization } = evaluateHistory(req);
  const issues: CognitiveResponse['issues'] = [];
  if (summary.valid_trials === 0) issues.push('missing_data');
  if (asOfMs - Date.parse(current.ended_at) > STALE_MS) issues.push('stale_data');
  if (!usable(current)) issues.push('poor_quality');
  if (current.phase === 'familiarization') issues.push('familiarization');
  if (current.phase === 'familiarization' || familiarization < 2 || baseline.length < 3) {
    issues.push('insufficient_history');
  }
  const order = ['missing_data', 'stale_data', 'poor_quality', 'insufficient_history'] as const;
  const analysis_status = order.find((s) => issues.includes(s)) ?? 'analyzed';
  const medians = baseline.map((s) => sessionSummary(s).median_reaction_time_ms ?? 0);
  const baselineMedian = analysis_status === 'analyzed' ? round3(medianOf(medians)) : null;
  const diff =
    baselineMedian !== null && summary.median_reaction_time_ms !== null
      ? round3(summary.median_reaction_time_ms - baselineMedian)
      : null;
  const who = synthetic ? 'synthetic' : 'real';
  const what = [
    summary.median_reaction_time_ms === null
      ? 'No valid responses were recorded in this session.'
      : `The recorded median reaction time was ${summary.median_reaction_time_ms} ms.`,
    `${summary.valid_trials} valid, ${summary.early_responses} early and ${summary.missed_responses} missed responses in ${current.trials.length} completed trials.`,
    baselineMedian !== null && diff !== null
      ? `The median of ${baseline.length} earlier comparable sessions was ${baselineMedian} ms; the difference is ${diff > 0 ? '+' : ''}${diff} ms.`
      : baseline.length === 0
        ? `No comparable ${who} baseline measurements were supplied.`
        : `Only ${baseline.length} comparable ${who} baseline measurement(s) were available; at least 3 are needed.`,
  ];
  const limitations = [
    ...(synthetic ? ['Synthetic demonstration only.'] : []),
    'Experimental ORBITA check; not a clinically validated PVT or NASA test.',
    'Browser and device timing is uncalibrated.',
    ...(synthetic ? [] : ['Submitted history and context are client assertions and may be incomplete. Practice effects remain possible.']),
    'Minor and patch browser/OS updates are tolerated and may affect comparability.',
    ...(req.context_observations.length > 0
      ? ['Sleep and heart-rate context is descriptive only and does not explain the reaction time.']
      : []),
  ];
  return {
    subject_id: req.subject_id,
    mode: req.mode,
    clock: req.clock,
    as_of: isoZ(asOfMs),
    session_id: current.session_id,
    timestamp: isoZ(Date.parse(current.ended_at)),
    test_version: 'orbita-rt-1',
    interpretation: synthetic ? 'synthetic_demonstration' : 'experimental_personal_summary',
    policy: DEMO_POLICY,
    analysis_status,
    issues,
    current: summary,
    baseline:
      baselineMedian !== null && diff !== null
        ? { session_ids: baseline.map((s) => s.session_id), median_reaction_time_ms: baselineMedian, signed_difference_ms: diff }
        : null,
    history_evaluation: evaluation,
    context_observations: req.context_observations.map((o) => evaluateObservation(o, asOfMs)),
    what_data_show: what,
    limitations,
    next_checks: NEXT[analysis_status],
    notices: echoNotices(req.notices),
  };
}
