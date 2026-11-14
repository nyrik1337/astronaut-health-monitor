"""Deterministic evidence inventory. Availability is not clinical normality."""

from .assessment_schemas import EvidenceItem, EvidenceResponse, NoticeOutput, Policy


def unverified_notices(payload):
    return [NoticeOutput(**notice.model_dump()) for notice in payload.notices]


def evidence_item(kind, observation, as_of):
    if observation is None:
        return EvidenceItem(kind=kind, status='missing_data', observed_at=None, value=None,
                            source=None, quality=None, age_seconds=None, issues=['missing_data'])
    age = (as_of - observation.observed_at).total_seconds()
    issues = []
    if observation.value is None:
        issues.append('missing_data')
    if age > getattr(Policy().freshness_seconds, kind):
        issues.append('stale_data')
    if observation.quality.status == 'poor':
        issues.append('poor_quality')
    if observation.quality.status == 'unknown':
        issues.append('quality_unknown')
    primary = next((issue for issue in issues if issue != 'quality_unknown'), 'available')
    return EvidenceItem(**observation.model_dump(), status=primary, age_seconds=age, issues=issues)


def assess_evidence(payload):
    by_kind = {item.kind: item for item in payload.observations}
    items = [evidence_item(kind, by_kind.get(kind), payload.as_of)
             for kind in ('heart_rate', 'sleep_duration', 'cognitive_test')]
    gaps = {item.status for item in items if item.status != 'available'}
    status = 'complete' if not gaps else next(iter(gaps)) if len(gaps) == 1 else 'mixed'
    facts, unknowns, checks = [], [], []
    for item in items:
        if item.value is not None:
            label = 'synthetic ' if payload.mode == 'simulation' else ''
            facts.append(f'The {label}{item.kind} observation is {item.value:g}; age {item.age_seconds:g} seconds; status {item.status}.')
        if item.status != 'available':
            unknowns.append(f'{item.kind}: {item.status}; usable current evidence is unavailable.')
        if 'quality_unknown' in item.issues:
            unknowns.append(f'{item.kind}: acquisition quality is unknown.')
        if item.kind != 'heart_rate' and item.status != 'available':
            checks.append(dict(code='sleep_check_in' if item.kind == 'sleep_duration' else 'reaction_time_check', optional=True))
    limitations = ['Heart rate alone cannot explain reported fatigue. This inventory is not a diagnosis.']
    if payload.mode == 'simulation':
        limitations.insert(0, 'Synthetic demonstration only.')
    if 'cognitive_test' in by_kind:
        limitations.append('Cognitive evidence is a client-supplied summary, not proof of a verified baseline.')
    return EvidenceResponse(subject_id=payload.subject_id, mode=payload.mode, clock=payload.clock,
                            as_of=payload.as_of, interpretation='synthetic_demonstration' if payload.mode == 'simulation' else 'evidence_inventory',
                            assessment_status=status, evidence=items, what_data_show=facts,
                            unknowns=unknowns, limitations=limitations, next_checks=checks,
                            notices=unverified_notices(payload))
