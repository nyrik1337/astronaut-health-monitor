"""Experimental personal summaries; no clinical inference or cross-source baselines."""

from math import ceil
from statistics import median

from .assessment_schemas import CognitiveResponse, Policy
from .evidence import evidence_item, unverified_notices


def valid_times(session):
    return sorted(trial.reaction_time_ms for trial in session.trials if trial.outcome == 'response')


def poor_quality(session):
    return session.completion == 'aborted' or len(valid_times(session)) < Policy().minimum_valid_trials


def comparable(left, right):
    a, b = left.context.model_dump(), right.context.model_dump()
    for field in ('browser_version', 'os_version'):
        a[field] = int(a[field].split('.')[0])
        b[field] = int(b[field].split('.')[0])
    return left.test_version == right.test_version and a == b


def analyze_cognitive(payload):
    policy = Policy()
    current = payload.current_test
    values = valid_times(current)
    current_median = median(values) if values else None
    summary = dict(valid_trials=len(values),
                   missed_responses=sum(t.outcome == 'missed' for t in current.trials),
                   early_responses=sum(t.outcome == 'early' for t in current.trials),
                   median_reaction_time_ms=round(current_median, 3) if values else None,
                   p90_reaction_time_ms=round(values[ceil(.9 * len(values)) - 1], 3) if values else None)
    familiarization, baseline_sessions, evaluation = [], [], []
    for session in payload.history:
        reasons = []
        if not comparable(session, current):
            reasons.append('context_mismatch')
        if poor_quality(session):
            reasons.append('poor_quality')
        if (current.started_at - session.ended_at).total_seconds() > policy.history_max_age_seconds:
            reasons.append('history_expired')
        if not reasons and session.phase == 'measurement':
            preceding = sum(s.ended_at < session.started_at for s in familiarization)
            if preceding < policy.familiarization_sessions:
                reasons.append('familiarization_incomplete')
        disposition = 'excluded'
        if not reasons:
            if session.phase == 'familiarization':
                familiarization.append(session)
                disposition = 'familiarization'
            else:
                baseline_sessions.append(session)
                disposition = 'baseline'
        evaluation.append(dict(session_id=session.session_id, disposition=disposition, reasons=reasons))
    insufficient = (current.phase == 'familiarization' or
                    len(familiarization) < policy.familiarization_sessions or
                    len(baseline_sessions) < policy.minimum_baseline_sessions)
    issues = []
    if not values:
        issues.append('missing_data')
    if (payload.as_of - current.ended_at).total_seconds() > policy.freshness_seconds.cognitive_test:
        issues.append('stale_data')
    if poor_quality(current):
        issues.append('poor_quality')
    if current.phase == 'familiarization':
        issues.append('familiarization')
    if insufficient:
        issues.append('insufficient_history')
    status = next((i for i in issues if i != 'familiarization'), 'analyzed')
    baseline = None
    facts = [f'The recorded median reaction time was {current_median:g} ms.'] if values else ['No valid current responses were recorded.']
    if status == 'analyzed':
        baseline_median = median(median(valid_times(s)) for s in baseline_sessions)
        baseline = dict(session_ids=[s.session_id for s in baseline_sessions],
                        median_reaction_time_ms=round(baseline_median, 3),
                        signed_difference_ms=round(current_median - baseline_median, 3))
        facts.append(f'The comparable-session baseline median was {baseline_median:g} ms; signed difference {current_median - baseline_median:+g} ms.')
    elif insufficient:
        facts.append(f'{len(baseline_sessions)} eligible baseline measurements and {len(familiarization)} familiarization sessions were supplied.')
    limitations = ['Experimental ORBITA check; not a clinically validated PVT or NASA test.',
                   'Browser and device timing is uncalibrated.',
                   'Submitted history and context are client assertions and may be incomplete. Practice effects remain possible.',
                   'Minor and patch browser/OS updates are tolerated and may affect comparability.']
    if payload.mode == 'simulation':
        limitations.insert(0, 'Synthetic demonstration only.')
    context = [evidence_item(o.kind, o, payload.as_of) for o in payload.context_observations]
    if context:
        limitations.append('Supplied sleep and pulse observations are descriptive context and do not establish the cause of reaction-time changes.')
        if any('quality_unknown' in o.issues for o in context):
            limitations.append('Acquisition quality is unknown for some supplied context observations.')
    check = {'missing_data': 'repeat_uninterrupted', 'poor_quality': 'repeat_uninterrupted',
             'stale_data': 'reaction_time_check', 'insufficient_history': 'collect_comparable_history'}.get(status)
    return CognitiveResponse(subject_id=payload.subject_id, mode=payload.mode, clock=payload.clock,
                             as_of=payload.as_of, session_id=current.session_id, timestamp=current.ended_at,
                             test_version=current.test_version,
                             interpretation='synthetic_demonstration' if payload.mode == 'simulation' else 'experimental_personal_summary',
                             analysis_status=status, issues=issues, current=summary, baseline=baseline,
                             history_evaluation=evaluation, context_observations=context,
                             what_data_show=facts, limitations=limitations,
                             next_checks=[dict(code=check, optional=True)] if check else [],
                             notices=unverified_notices(payload))
