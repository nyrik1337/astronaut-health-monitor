"""Semantic validation, independent of wall clocks and HTTP transport."""

from .assessment_schemas import CognitiveRequest, EvidenceRequest


def schema_details(exc):
    details = []
    for issue in exc.errors():
        kind = issue['type']
        code = {'missing': 'REQUIRED_FIELD', 'extra_forbidden': 'UNKNOWN_FIELD',
                'too_long': 'LIMIT_EXCEEDED', 'string_too_long': 'LIMIT_EXCEEDED',
                'INVALID_TIMESTAMP': 'INVALID_TIMESTAMP'}.get(kind, 'INVALID_VALUE')
        path = '.'.join(str(part) for part in issue['loc'])
        if '.trials' in path or path.endswith('.interruptions'):
            if code not in ('REQUIRED_FIELD', 'UNKNOWN_FIELD', 'LIMIT_EXCEEDED'):
                code = 'INVALID_TRIALS'
        details.append(dict(field=path, code=code, message=issue['msg']))
    return details


def validate_assessment(payload, received_at):
    details = []

    def add(field, code, message):
        details.append(dict(field=field, code=code, message=message))

    def event(stamp, field):
        if stamp > payload.as_of:
            add(field, 'FUTURE_OBSERVATION', 'Observation timestamp must not be later than as_of.')

    def source(value, field, cognitive=False):
        allowed = {'simulated'} if payload.mode == 'simulation' else (
            {'browser_measured'} if cognitive else {'browser_measured', 'real_device', 'human_entered'})
        if value.kind not in allowed:
            message = ('Real cognitive history must be browser_measured.'
                       if payload.mode == 'real_assessment' and cognitive and field.startswith('history.')
                       else 'Source is not permitted for this mode and evidence type.')
            add(field + '.kind', 'PROVENANCE_MODE_MISMATCH', message)
        if value.kind == 'research_dataset' and value.source_id is None:
            add(field + '.source_id', 'INVALID_VALUE', 'Research dataset identifier is required.')

    def observations(values, field, context=False):
        seen = set()
        for i, value in enumerate(values):
            path = f'{field}.{i}'
            if value.kind in seen:
                add(path + '.kind', 'DUPLICATE_OBSERVATION', 'Observation kinds must be unique.')
            seen.add(value.kind)
            if context and value.kind == 'cognitive_test':
                add(path + '.kind', 'INVALID_VALUE', 'Context permits only heart_rate and sleep_duration.')
            event(value.observed_at, path + '.observed_at')
            source(value.source, path + '.source', value.kind == 'cognitive_test')
            if value.value is not None:
                valid = (value.value > 0 if value.kind == 'heart_rate' else
                         0 <= value.value <= 24 if value.kind == 'sleep_duration' else
                         0 < value.value <= 1500)
                if not valid:
                    add(path + '.value', 'INVALID_VALUE', 'Value is outside the evidence data bounds.')
            if (value.quality.status == 'poor') != bool(value.quality.reasons):
                add(path + '.quality.reasons', 'INVALID_VALUE', 'Only poor quality requires nonempty reasons.')

    if payload.mode == 'simulation':
        if payload.clock.kind != 'mission':
            add('clock', 'CLOCK_MISMATCH', 'Simulation requires a mission clock.')
    else:
        if payload.clock.kind != 'utc' or payload.clock.id != 'utc':
            add('clock', 'CLOCK_MISMATCH', 'Real assessment requires the utc clock with id utc.')
        if abs((payload.as_of - received_at).total_seconds()) > 300:
            add('as_of', 'AS_OF_OUT_OF_RANGE', 'Real as_of must be within 300 seconds of receipt UTC.')
    for i, notice in enumerate(payload.notices):
        event(notice.reported_at, f'notices.{i}.reported_at')
        source(notice.source, f'notices.{i}.source')

    if isinstance(payload, EvidenceRequest):
        event(payload.reported_issue.reported_at, 'reported_issue.reported_at')
        source(payload.reported_issue.source, 'reported_issue.source')
        observations(payload.observations, 'observations')
        return details

    assert isinstance(payload, CognitiveRequest)
    observations(payload.context_observations, 'context_observations', context=True)
    sessions = [('current_test', payload.current_test)] + [(f'history.{i}', s) for i, s in enumerate(payload.history)]
    ids, ends = set(), set()
    previous = None
    for path, session in sessions:
        if session.subject_id != payload.subject_id:
            add(path + '.subject_id', 'SUBJECT_MISMATCH', 'Session subject must match request subject.')
        if session.clock != payload.clock:
            add(path + '.clock', 'CLOCK_MISMATCH', 'Session clock must match request clock.')
        source(session.source, path + '.source', cognitive=True)
        event(session.started_at, path + '.started_at')
        event(session.ended_at, path + '.ended_at')
        if session.session_id in ids:
            add(path + '.session_id', 'DUPLICATE_ID', 'Session IDs must be unique.')
        if session.ended_at in ends:
            add(path + '.ended_at', 'DUPLICATE_TIMESTAMP', 'Session end instants must be unique.')
        ids.add(session.session_id)
        ends.add(session.ended_at)
        if path.startswith('history.'):
            if previous is not None and session.ended_at <= previous:
                add(path + '.ended_at', 'TIMESTAMP_OUT_OF_ORDER', 'History must be strictly ascending by end time.')
            previous = session.ended_at
            if session.ended_at >= payload.current_test.started_at:
                add(path + '.ended_at', 'TIMESTAMP_NOT_BEFORE_CURRENT', 'History must end before current start.')
        duration = (session.ended_at - session.started_at).total_seconds()
        if duration < 0 or duration > 150 or (session.completion == 'completed' and duration < 12.5):
            add(path + '.ended_at', 'INVALID_SESSION_INTERVAL', 'Session duration is outside protocol bounds.')
        completed = session.completion == 'completed'
        if ((completed and (len(session.trials) != 20 or session.interruptions)) or
                (not completed and (len(session.trials) > 19 or not session.interruptions)) or
                len(set(session.interruptions)) != len(session.interruptions)):
            add(path + '.completion', 'INVALID_TRIALS', 'Completion, trial count and interruptions disagree.')
        for i, trial in enumerate(session.trials):
            valid = (trial.reaction_time_ms is not None and 100 <= trial.reaction_time_ms <= 1500
                     if trial.outcome == 'response' else trial.reaction_time_ms is None)
            if trial.index != i + 1 or not 1000 <= trial.wait_ms <= 3000 or not valid:
                add(f'{path}.trials.{i}', 'INVALID_TRIALS', 'Trial index, wait or outcome/value violates protocol.')
    return details
