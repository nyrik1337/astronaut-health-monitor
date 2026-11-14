"""Bounded HTTP transport for extension routes; CPU work stays off the event loop."""

import json
from datetime import datetime, timezone

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from .assessment_schemas import CognitiveRequest, CognitiveResponse, EvidenceRequest, EvidenceResponse
from .assessment_validation import schema_details, validate_assessment
from .cognitive import analyze_cognitive
from .evidence import assess_evidence

REQUEST_MODELS = {'/api/evidence/assess': EvidenceRequest, '/api/cognitive/analyze': CognitiveRequest}


def utc_now():
    return datetime.now(timezone.utc)


def register_routes(api, error, validation_error, max_body_bytes):
    def process(chunks, model, analyze, received_at):
        try:
            data = json.loads(chunks)
        except (ValueError, UnicodeError, RecursionError):
            return error(400, 'MALFORMED_JSON', 'Request body is not valid JSON.')
        try:
            payload = model.model_validate(data)
        except ValidationError as exc:
            return validation_error(schema_details(exc))
        details = validate_assessment(payload, received_at)
        if details:
            return validation_error(details)
        return JSONResponse(analyze(payload).model_dump(mode='json'))

    async def handle(request, model, analyze):
        received_at = utc_now()
        chunks = bytearray()
        async for chunk in request.stream():
            if len(chunks) + len(chunk) > max_body_bytes:
                return error(413, 'REQUEST_TOO_LARGE', 'Request body must not exceed 1048576 bytes.')
            chunks.extend(chunk)
        if request.headers.get('content-type', '').split(';', 1)[0].strip().lower() != 'application/json':
            return error(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.')
        return await run_in_threadpool(process, chunks, model, analyze, received_at)

    @api.post('/api/evidence/assess', response_model=EvidenceResponse)
    async def evidence_endpoint(request: Request):
        return await handle(request, EvidenceRequest, assess_evidence)

    @api.post('/api/cognitive/analyze', response_model=CognitiveResponse)
    async def cognitive_endpoint(request: Request):
        return await handle(request, CognitiveRequest, analyze_cognitive)
