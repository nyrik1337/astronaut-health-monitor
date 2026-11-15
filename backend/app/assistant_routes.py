"""Assistant HTTP boundary; existing analyses never depend on model availability."""

import asyncio
import json
from datetime import datetime, timezone

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from . import assistant
from .assessment_validation import schema_details
from .assistant_schemas import AssistantRequest, AssistantResponse

REQUEST_MODELS = {'/api/assistant/chat': AssistantRequest}


def utc_now():
    return datetime.now(timezone.utc)


def register_routes(api, error, validation_error, max_body_bytes):
    def prepare(chunks, received_at):
        try:
            data = json.loads(chunks)
        except (ValueError, UnicodeError, RecursionError):
            return error(400, 'MALFORMED_JSON', 'Request body is not valid JSON.')
        try:
            payload = AssistantRequest.model_validate(data)
        except ValidationError as exc:
            return validation_error(schema_details(exc))
        details = assistant.validate_context(payload, received_at)
        if details:
            return validation_error(details)
        return payload, assistant.prepare_context(payload)

    @api.post('/api/assistant/chat', response_model=AssistantResponse)
    async def chat_endpoint(request: Request):
        received_at = utc_now()
        chunks = bytearray()
        async for chunk in request.stream():
            if len(chunks) + len(chunk) > max_body_bytes:
                return error(413, 'REQUEST_TOO_LARGE', 'Request body must not exceed 1048576 bytes.')
            chunks.extend(chunk)
        if request.headers.get('content-type', '').split(';', 1)[0].strip().lower() != 'application/json':
            return error(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.')
        prepared = await run_in_threadpool(prepare, chunks, received_at)
        if isinstance(prepared, JSONResponse):
            return prepared
        payload, (evidence, cognitive, limitations, context) = prepared
        try:
            settings = assistant.Settings.from_env()
            answer, truncated = await asyncio.wait_for(
                asyncio.to_thread(assistant.generate, payload.question, context, settings),
                timeout=settings.timeout,
            )
        except TimeoutError:
            return error(504, 'ASSISTANT_TIMEOUT', assistant.ERRORS['ASSISTANT_TIMEOUT'][1])
        except assistant.AssistantError as exc:
            return error(exc.status, exc.code, exc.message)
        result = assistant.make_response(payload, evidence, cognitive, limitations, settings, answer, truncated)
        return JSONResponse(result.model_dump(mode='json'))
