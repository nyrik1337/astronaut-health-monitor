"""Strict wire models for the approved evidence-cognitive-1 extension."""

import math
import re
from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, PlainSerializer
from pydantic_core import PydanticCustomError


def parse_timestamp(value):
    if isinstance(value, datetime):  # Internal response construction only.
        return value
    pattern = r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-5][0-9](?:\.[0-9]{1,3})?(?:Z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])"
    try:
        if not isinstance(value, str) or not re.fullmatch(pattern, value) or value.endswith('-00:00'):
            raise ValueError
        return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(timezone.utc)
    except (ValueError, OverflowError):
        raise PydanticCustomError('INVALID_TIMESTAMP', 'Timestamp must be a valid timezone-aware RFC 3339 instant with at most 3 fractional digits.') from None


def finite_number(value):
    try:
        valid = type(value) in (int, float) and math.isfinite(value)
    except OverflowError:
        valid = False
    if not valid:
        raise PydanticCustomError('INVALID_VALUE', 'Value must be a finite JSON number.')
    return value


def serialize_timestamp(value):
    return value.astimezone(timezone.utc).isoformat(
        timespec='milliseconds' if value.microsecond else 'seconds').replace('+00:00', 'Z')


Stamp = Annotated[datetime, BeforeValidator(parse_timestamp),
                  PlainSerializer(serialize_timestamp, return_type=str, when_used='json')]
Number = Annotated[float, BeforeValidator(finite_number)]
ID = Annotated[str, Field(min_length=1, max_length=128)]
Text = Annotated[str, Field(min_length=1, max_length=500)]
Version = Annotated[str, Field(min_length=1, max_length=128, pattern=r'^[0-9]+(\.[0-9]+){0,3}$')]
Mode = Literal['simulation', 'real_assessment']
Kind = Literal['heart_rate', 'sleep_duration', 'cognitive_test']
EvidenceStatus = Literal['available', 'missing_data', 'stale_data', 'poor_quality']
EvidenceIssue = Literal['missing_data', 'stale_data', 'poor_quality', 'quality_unknown']
CognitiveStatus = Literal['analyzed', 'insufficient_history', 'missing_data', 'poor_quality', 'stale_data']
CognitiveIssue = Literal['missing_data', 'stale_data', 'poor_quality', 'familiarization', 'insufficient_history']
HistoryReason = Literal['context_mismatch', 'poor_quality', 'history_expired', 'familiarization_incomplete']


class WireModel(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True, allow_inf_nan=False)


class Clock(WireModel):
    kind: Literal['mission', 'utc']
    id: ID


class Source(WireModel):
    kind: Literal['simulated', 'browser_measured', 'real_device', 'human_entered', 'research_dataset']
    source_id: ID | None


class Quality(WireModel):
    status: Literal['unknown', 'acceptable', 'poor']
    reasons: list[Text] = Field(max_length=8)


class NoticeInput(WireModel):
    id: ID
    reported_at: Stamp
    source: Source
    text: Text


class NoticeOutput(NoticeInput):
    verification: Literal['unverified_client_input'] = 'unverified_client_input'


class NextCheck(WireModel):
    code: Literal['sleep_check_in', 'reaction_time_check', 'collect_comparable_history', 'repeat_uninterrupted']
    optional: Literal[True] = True


class Freshness(WireModel):
    heart_rate: Literal[900] = 900
    sleep_duration: Literal[129600] = 129600
    cognitive_test: Literal[86400] = 86400


class Policy(WireModel):
    version: Literal['demo-1'] = 'demo-1'
    freshness_seconds: Freshness = Field(default_factory=Freshness)
    history_max_age_seconds: Literal[2592000] = 2592000
    familiarization_sessions: Literal[2] = 2
    minimum_baseline_sessions: Literal[3] = 3
    minimum_valid_trials: Literal[16] = 16


class Observation(WireModel):
    kind: Kind
    observed_at: Stamp
    value: Number | None
    source: Source
    quality: Quality


class ReportedIssue(WireModel):
    code: Literal['fatigue']
    reported_at: Stamp
    source: Source


class AssessmentRequest(WireModel):
    subject_id: ID
    mode: Mode
    clock: Clock
    as_of: Stamp
    notices: list[NoticeInput] = Field(max_length=16)


class EvidenceRequest(AssessmentRequest):
    reported_issue: ReportedIssue
    observations: list[Observation] = Field(max_length=3)


class Trial(WireModel):
    index: int
    wait_ms: int
    outcome: Literal['response', 'early', 'missed']
    reaction_time_ms: Number | None


class TestContext(WireModel):
    setup_id: ID
    device_class: Literal['desktop', 'laptop']
    browser_family: Literal['chrome', 'edge', 'firefox', 'safari']
    browser_version: Version
    os_family: Literal['windows', 'macos', 'linux']
    os_version: Version
    input_method: Literal['keyboard_space']
    timing_api: Literal['performance_now']


class Session(WireModel):
    session_id: ID
    subject_id: ID
    clock: Clock
    test_version: Literal['orbita-rt-1']
    phase: Literal['familiarization', 'measurement']
    started_at: Stamp
    ended_at: Stamp
    source: Source
    context: TestContext
    completion: Literal['completed', 'aborted']
    interruptions: list[Literal['visibility_lost', 'window_blur', 'cancelled', 'held_key', 'scheduler_gap']] = Field(max_length=5)
    trials: list[Trial] = Field(max_length=20)


class CognitiveRequest(AssessmentRequest):
    current_test: Session
    history: list[Session] = Field(max_length=100)
    context_observations: list[Observation] = Field(max_length=2)


class EvidenceItem(WireModel):
    kind: Kind
    status: EvidenceStatus
    observed_at: Stamp | None
    value: Number | None
    source: Source | None
    quality: Quality | None
    age_seconds: Number | None
    issues: list[EvidenceIssue]


Explanation = Annotated[list[Text], Field(max_length=10)]


class AssessmentResponse(WireModel):
    subject_id: ID
    mode: Mode
    clock: Clock
    as_of: Stamp
    policy: Policy = Field(default_factory=Policy)
    what_data_show: Explanation
    limitations: Explanation
    next_checks: list[NextCheck]
    notices: list[NoticeOutput]


class EvidenceResponse(AssessmentResponse):
    interpretation: Literal['synthetic_demonstration', 'evidence_inventory']
    assessment_status: Literal['complete', 'missing_data', 'stale_data', 'poor_quality', 'mixed']
    evidence: list[EvidenceItem]
    unknowns: Explanation


class Summary(WireModel):
    valid_trials: int
    missed_responses: int
    early_responses: int
    median_reaction_time_ms: Number | None
    p90_reaction_time_ms: Number | None


class CognitiveBaseline(WireModel):
    session_ids: list[ID]
    median_reaction_time_ms: Number
    signed_difference_ms: Number


class HistoryEvaluation(WireModel):
    session_id: ID
    disposition: Literal['baseline', 'familiarization', 'excluded']
    reasons: list[HistoryReason]


class CognitiveResponse(AssessmentResponse):
    session_id: ID
    timestamp: Stamp
    test_version: Literal['orbita-rt-1']
    interpretation: Literal['synthetic_demonstration', 'experimental_personal_summary']
    analysis_status: CognitiveStatus
    issues: list[CognitiveIssue]
    current: Summary
    baseline: CognitiveBaseline | None
    history_evaluation: list[HistoryEvaluation]
    context_observations: list[EvidenceItem]
