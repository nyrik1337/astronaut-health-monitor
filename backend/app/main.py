"""HTTP boundary: bounded requests, consistent errors, and localhost CORS."""

import json

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException

from .analysis import analyze
from .schemas import AnalyzeRequest, AnalyzeResponse
from .assessment_routes import REQUEST_MODELS, register_routes
from .assistant_routes import REQUEST_MODELS as ASSISTANT_MODELS, register_routes as register_assistant_routes

MAX_BODY_BYTES = 1_048_576
api = FastAPI(title="Astronaut Health Monitor", version="0.1.0",
              docs_url="/docs", redoc_url=None, openapi_url="/openapi.json")


def openapi_schema():
    if api.openapi_schema is None:
        schema = get_openapi(title=api.title, version=api.version, routes=api.routes)
        # The endpoint reads the stream itself to enforce the byte limit before
        # parsing. Publish its Pydantic body schema without changing that path.
        request_schema = AnalyzeRequest.model_json_schema(ref_template="#/components/schemas/{model}")
        components = schema.setdefault("components", {}).setdefault("schemas", {})
        components.update(request_schema.pop("$defs", {}))
        components["AnalyzeRequest"] = request_schema
        schema["paths"]["/api/analyze"]["post"]["requestBody"] = {
            "required": True,
            "content": {"application/json": {"schema": {"$ref": "#/components/schemas/AnalyzeRequest"}}},
        }
        for path, model in {**REQUEST_MODELS, **ASSISTANT_MODELS}.items():
            body_schema = model.model_json_schema(ref_template="#/components/schemas/{model}")
            components.update(body_schema.pop("$defs", {}))
            components[model.__name__] = body_schema
            schema["paths"][path]["post"]["requestBody"] = {
                "required": True,
                "content": {"application/json": {"schema": {"$ref": f"#/components/schemas/{model.__name__}"}}},
            }
        api.openapi_schema = schema
    return api.openapi_schema


api.openapi = openapi_schema


def error(status, code, message, details=None):
    return JSONResponse(status_code=status, content={"error": {
        "code": code, "message": message, "details": details or [],
    }})


def validation_error(details):
    return error(422, "VALIDATION_ERROR", "Request validation failed.", details)


def schema_details(exc):
    details = []
    for issue in exc.errors():
        path = [str(part) for part in issue["loc"] if part != "[key]"]
        code, message = issue["type"], issue["msg"]
        if path == ["history"] and code == "too_long":
            code, message = "HISTORY_LIMIT_EXCEEDED", "History may contain at most 1000 records."
        elif "[key]" in issue["loc"]:
            code, message = "INVALID_METRIC_NAME", "Metric names must match ^[a-z][a-z0-9_]{0,63}$."
        details.append(dict(field=".".join(path), code=code.upper(), message=message))
    return details


def history_details(payload):
    details, seen = [], set()
    previous = None
    for index, record in enumerate(payload.history):
        stamp = record.timestamp
        field = f"history.{index}.timestamp"
        if stamp in seen:
            details.append(dict(field=field, code="DUPLICATE_TIMESTAMP",
                                message="Historical timestamps must be unique."))
        elif previous is not None and stamp <= previous:
            details.append(dict(field=field, code="TIMESTAMP_OUT_OF_ORDER",
                                message="Historical timestamps must be strictly ascending."))
        if stamp >= payload.timestamp:
            details.append(dict(field=field, code="TIMESTAMP_NOT_BEFORE_CURRENT",
                                message="Historical timestamp must precede the current timestamp."))
        seen.add(stamp)
        previous = stamp
    return details


@api.exception_handler(Exception)
async def unexpected_error(request, exc):
    return error(500, "INTERNAL_ERROR", "The analysis could not be completed.")


@api.exception_handler(HTTPException)
async def http_error(request, exc):
    return error(exc.status_code, "HTTP_ERROR", str(exc.detail))


@api.get("/health")
async def health():
    return {"status": "ok", "service": "astronaut-health-monitor", "version": "0.1.0"}


@api.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_endpoint(request: Request):
    chunks = bytearray()
    # Count actual bytes, including chunked requests; never trust Content-Length alone.
    async for chunk in request.stream():
        if len(chunks) + len(chunk) > MAX_BODY_BYTES:
            return error(413, "REQUEST_TOO_LARGE", "Request body must not exceed 1048576 bytes.")
        chunks.extend(chunk)
    if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
        return error(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.")
    try:
        data = json.loads(chunks)
    except (ValueError, UnicodeError, RecursionError):
        return error(400, "MALFORMED_JSON", "Request body is not valid JSON.")
    try:
        payload = AnalyzeRequest.model_validate(data)
    except ValidationError as exc:
        return validation_error(schema_details(exc))
    details = history_details(payload)
    if details:
        return validation_error(details)
    result = await run_in_threadpool(analyze, payload)
    return JSONResponse(result.model_dump(mode="json"))


register_routes(api, error, validation_error, MAX_BODY_BYTES)
register_assistant_routes(api, error, validation_error, MAX_BODY_BYTES)

# Wrap the whole app so even unexpected server errors include CORS headers.
app = CORSMiddleware(api, allow_origins=["http://localhost:5173"],
                     allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
