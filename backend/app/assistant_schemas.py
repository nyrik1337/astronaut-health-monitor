"""Wire models for the additive assistant-1 contract."""

from typing import Literal

from pydantic import Field, field_validator

from .assessment_schemas import (
    Clock, CognitiveRequest, CognitiveResponse, EvidenceRequest, EvidenceResponse,
    ID, Mode, Stamp, WireModel,
)


class AssistantRequest(WireModel):
    subject_id: ID
    mode: Mode
    clock: Clock
    as_of: Stamp
    question: str = Field(min_length=1, max_length=2000)
    evidence: EvidenceRequest | None
    cognitive: CognitiveRequest | None
    gentle_breathing_available: bool

    @field_validator('question')
    @classmethod
    def nonblank_question(cls, value):
        if not value.strip():
            raise ValueError('Question must contain non-whitespace text.')
        return value


class AssistantResponse(WireModel):
    subject_id: ID
    mode: Mode
    clock: Clock
    as_of: Stamp
    answer: str = Field(min_length=1, max_length=8000)
    model: ID
    generation: Literal['local_ollama'] = 'local_ollama'
    provenance: Literal['client_asserted_real', 'synthetic_demonstration']
    evidence: EvidenceResponse | None
    cognitive: CognitiveResponse | None
    limitations: list[str]
    disclaimer: str
    truncated: bool
