import copy
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import main


@pytest.fixture
def client():
    with TestClient(main.app, raise_server_exceptions=False) as test_client:
        yield test_client


@pytest.fixture
def payload():
    return {
        "subject_id": "crew-01", "timestamp": "2026-10-04T14:30:00Z",
        "measurements": {"heart_rate_bpm": 74},
        "history": [
            {"timestamp": f"2026-10-04T{hour:02}:30:00Z", "measurements": {"heart_rate_bpm": value}}
            for hour, value in zip(range(9, 14), [68, 70, 72, 69, 71])
        ],
    }


def post(client, payload):
    return client.post("/api/analyze", json=payload)


def test_swagger_ui_enabled(client):
    response = client.get("/docs")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "SwaggerUIBundle" in response.text
    assert "/openapi.json" in response.text


def test_openapi_documents_endpoints_and_analyze_models(client):
    response = client.get("/openapi.json")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    schema = response.json()
    assert "get" in schema["paths"]["/health"]
    operation = schema["paths"]["/api/analyze"]["post"]
    body = operation["requestBody"]
    assert body["required"] is True
    assert body["content"]["application/json"]["schema"]["$ref"] == "#/components/schemas/AnalyzeRequest"
    assert operation["responses"]["200"]["content"]["application/json"]["schema"]["$ref"] == "#/components/schemas/AnalyzeResponse"
    assert set(schema["components"]["schemas"]["AnalyzeRequest"]["required"]) == {
        "subject_id", "timestamp", "measurements", "history",
    }
    # Every local reference must resolve, including nested historical records.
    def check_refs(value):
        if isinstance(value, dict):
            if "$ref" in value:
                target = schema
                for part in value["$ref"].removeprefix("#/").split("/"):
                    target = target[part.replace("~1", "/").replace("~0", "~")]
            for child in value.values():
                check_refs(child)
        elif isinstance(value, list):
            for child in value:
                check_refs(child)
    check_refs(schema)
    assert client.get("/openapi.json").json() == schema


def test_contract_examples_with_approved_rounding_correction(client):
    contract = (Path(__file__).resolve().parents[2] / "docs/API_CONTRACT.md").read_text(encoding="utf-8")
    examples = [json.loads(block) for block in re.findall(r"```json\s*(.*?)\s*```", contract, re.S)]
    # Approved clarification: the formula rounds 4 / 1.4826 to 2.698.
    # The source contract stays unchanged; all other example fields match exactly.
    examples[2]["metrics"]["heart_rate_bpm"]["deviation"]["robust_z_score"] = 2.698
    assert client.get("/health").json() == examples[0]
    for index in (1, 3):
        response = post(client, examples[index])
        assert response.status_code == 200
        assert response.json() == examples[index + 1]


def test_baseline_excludes_current_and_signed_score(client, payload):
    payload["measurements"]["heart_rate_bpm"] = 66
    result = post(client, payload).json()
    assert result["analysis_status"] == "complete"
    assert result["warnings"] == []
    metric = result["metrics"]["heart_rate_bpm"]
    assert metric["baseline"] == {"median": 70, "mad": 1, "scaled_mad": 1.4826}
    assert metric["deviation"] == {"absolute": 4, "robust_z_score": -2.698}


@pytest.mark.parametrize("values", [[98, 98, 98, 99, 100], [98] * 5])
def test_zero_mad_counts_as_complete(client, payload, values):
    for record, value in zip(payload["history"], values):
        record["measurements"]["heart_rate_bpm"] = value
    result = post(client, payload).json()
    assert result["analysis_status"] == "complete"
    metric = result["metrics"]["heart_rate_bpm"]
    assert metric["status"] == "zero_variability"
    assert metric["deviation"] == {"absolute": 24, "robust_z_score": None}
    assert result["warnings"][0]["code"] == "ZERO_BASELINE_VARIABILITY"


def test_null_and_absent_history_are_excluded(client, payload):
    payload["history"][0]["measurements"]["heart_rate_bpm"] = None
    payload["history"][1]["measurements"] = {}
    result = post(client, payload).json()
    assert result["analysis_status"] == "insufficient_history"
    assert result["metrics"]["heart_rate_bpm"] == {
        "current": 74, "status": "insufficient_history", "history_samples": 3,
        "baseline": None, "deviation": None,
    }


@pytest.mark.parametrize("history_present", [True, False])
def test_missing_current_keeps_sample_count(client, payload, history_present):
    payload["measurements"]["heart_rate_bpm"] = None
    if not history_present:
        payload["history"] = []
    result = post(client, payload).json()
    assert result["analysis_status"] == "no_current_data"
    metric = result["metrics"]["heart_rate_bpm"]
    assert metric["history_samples"] == (5 if history_present else 0)
    assert metric["baseline"] is None and metric["deviation"] is None
    assert result["warnings"] == [{"code": "NO_CURRENT_DATA", "metric": None,
                                    "message": "All current measurement values are null."}]


def test_mixed_missing_and_numeric_status(client, payload):
    payload["measurements"]["spo2_percent"] = None
    result = post(client, payload).json()
    assert result["analysis_status"] == "partial"
    assert result["warnings"] == []
    payload["history"] = []
    result = post(client, payload).json()
    assert result["analysis_status"] == "insufficient_history"
    assert len(result["warnings"]) == 1


def test_additional_metrics_and_ignored_historical_metrics(client, payload):
    payload["measurements"] = {"custom_unit": -10}
    for index, record in enumerate(payload["history"]):
        record["measurements"]["custom_unit"] = index
    result = post(client, payload).json()
    assert list(result["metrics"]) == ["custom_unit"]
    assert result["metrics"]["custom_unit"]["baseline"]["median"] == 2


@pytest.mark.parametrize("value", [True, False, "98", {}, [], float("nan"), float("inf"), -float("inf")])
@pytest.mark.parametrize("historical", [True, False])
def test_invalid_measurements(client, payload, value, historical):
    target = payload["history"][0] if historical else payload
    target["measurements"]["heart_rate_bpm"] = value
    response = client.post("/api/analyze", content=json.dumps(payload), headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    detail = response.json()["error"]["details"][0]
    assert detail["code"] == "INVALID_MEASUREMENT"
    assert detail["field"] == ("history.0." if historical else "") + "measurements.heart_rate_bpm"


@pytest.mark.parametrize("name", ["Heart_rate", "1value", "a-b", "", "a" * 65, "a\n"])
def test_invalid_metric_names(client, payload, name):
    payload["measurements"] = {name: 1}
    assert post(client, payload).status_code == 422


@pytest.mark.parametrize("value", ["2026-10-04T14:30:00", "not-a-date", 1791124200, None, "2026-10-04"])
def test_invalid_timestamps(client, payload, value):
    payload["timestamp"] = value
    assert post(client, payload).status_code == 422


def test_timestamp_comparisons_use_instants(client, payload):
    payload["timestamp"] = "2026-10-04T19:30:00+05:00"
    assert post(client, payload).json()["timestamp"] == "2026-10-04T14:30:00Z"
    payload["history"][1]["timestamp"] = "2026-10-04T14:30:00+05:00"
    response = post(client, payload)
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["code"] == "DUPLICATE_TIMESTAMP"


@pytest.mark.parametrize("stamp,code", [
    ("2026-10-04T09:30:00Z", "DUPLICATE_TIMESTAMP"),
    ("2026-10-04T08:30:00Z", "TIMESTAMP_OUT_OF_ORDER"),
    ("2026-10-04T14:30:00Z", "TIMESTAMP_NOT_BEFORE_CURRENT"),
    ("2026-10-05T14:30:00Z", "TIMESTAMP_NOT_BEFORE_CURRENT"),
])
def test_invalid_history_order(client, payload, stamp, code):
    payload["history"][-1]["timestamp"] = stamp
    response = post(client, payload)
    assert response.status_code == 422
    assert code in [d["code"] for d in response.json()["error"]["details"]]


@pytest.mark.parametrize("field", ["subject_id", "timestamp", "measurements", "history"])
def test_required_fields(client, payload, field):
    del payload[field]
    assert post(client, payload).status_code == 422


@pytest.mark.parametrize("subject", ["", "a" * 129, 1, None])
def test_invalid_subject(client, payload, subject):
    payload["subject_id"] = subject
    assert post(client, payload).status_code == 422


@pytest.mark.parametrize("size,expected", [(0, 422), (64, 200), (65, 422)])
def test_current_metric_limits(client, payload, size, expected):
    payload["measurements"] = {f"metric_{i}": 1 for i in range(size)}
    assert post(client, payload).status_code == expected


@pytest.mark.parametrize("size,expected", [(0, 200), (64, 200), (65, 422)])
def test_historical_metric_limits(client, payload, size, expected):
    payload["history"][0]["measurements"] = {f"metric_{i}": 1 for i in range(size)}
    assert post(client, payload).status_code == expected


@pytest.mark.parametrize("size,expected", [(0, 200), (1000, 200), (1001, 422)])
def test_history_limit(client, payload, size, expected):
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    payload["history"] = [dict(timestamp=(start + timedelta(minutes=i)).isoformat(), measurements={}) for i in range(size)]
    response = post(client, payload)
    assert response.status_code == expected
    if expected == 422:
        assert response.json()["error"]["details"] == [{"field": "history", "code": "HISTORY_LIMIT_EXCEEDED",
                                                       "message": "History may contain at most 1000 records."}]


@pytest.mark.parametrize("body", ["{", "", '{"x":', b"\xff", "[" * 2000])
def test_malformed_json(client, body):
    response = client.post("/api/analyze", content=body, headers={"Content-Type": "application/json"})
    assert response.status_code == 400
    assert response.json()["error"] == {"code": "MALFORMED_JSON", "message": "Request body is not valid JSON.", "details": []}


def test_unsupported_media_type(client, payload):
    response = client.post("/api/analyze", content=json.dumps(payload))
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "UNSUPPORTED_MEDIA_TYPE"


@pytest.mark.parametrize("extra,expected", [(0, 200), (1, 413)])
def test_body_size_boundary(client, payload, extra, expected):
    body = json.dumps(payload).encode()
    body += b" " * (main.MAX_BODY_BYTES - len(body) + extra)
    response = client.post("/api/analyze", content=body, headers={"Content-Type": "application/json"})
    assert response.status_code == expected


def test_chunked_body_limit(client):
    response = client.post("/api/analyze", content=iter([b" " * 600_000, b" " * 600_000]),
                           headers={"Content-Type": "application/json"})
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "REQUEST_TOO_LARGE"


def test_cors(client, payload):
    origin = {"Origin": "http://localhost:5173"}
    preflight = client.options("/api/analyze", headers={**origin, "Access-Control-Request-Method": "POST",
                                                       "Access-Control-Request-Headers": "content-type"})
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == origin["Origin"]
    for response in [client.get("/health", headers=origin), client.post("/api/analyze", json={}, headers=origin)]:
        assert response.headers["access-control-allow-origin"] == origin["Origin"]
    assert "access-control-allow-origin" not in client.get("/health", headers={"Origin": "https://other.example"}).headers


def test_safe_server_error_with_cors(client, payload, monkeypatch):
    def fail(_):
        raise RuntimeError("private exception information")
    monkeypatch.setattr(main, "analyze", fail)
    response = client.post("/api/analyze", json=payload, headers={"Origin": "http://localhost:5173"})
    assert response.status_code == 500
    assert response.json() == {"error": {"code": "INTERNAL_ERROR", "message": "The analysis could not be completed.", "details": []}}
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_analysis_is_stateless(client, payload):
    original = copy.deepcopy(payload)
    first = post(client, payload).json()
    payload["history"] = []
    assert post(client, payload).json()["analysis_status"] == "insufficient_history"
    assert post(client, original).json() == first


@pytest.mark.parametrize("body", [None, [], 42, "text"])
def test_non_object_json(client, body):
    response = client.post("/api/analyze", content=json.dumps(body), headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_even_sample_median_and_full_precision(client, payload):
    values = [1.0004, 2.0004, 3.0004, 4.0004, 5.0004, 6.0004]
    payload["history"] = [dict(timestamp=f"2026-10-04T{hour:02}:00:00Z", measurements={"heart_rate_bpm": value})
                          for hour, value in enumerate(values)]
    payload["measurements"]["heart_rate_bpm"] = 7
    metric = post(client, payload).json()["metrics"]["heart_rate_bpm"]
    assert metric["baseline"] == {"median": 3.5, "mad": 1.5, "scaled_mad": 2.2239}
    assert metric["deviation"] == {"absolute": 3.5, "robust_z_score": round((7 - 3.5004) / 2.2239, 3)}


def test_status_uses_unrounded_mad(client, payload):
    for index, record in enumerate(payload["history"]):
        record["measurements"]["heart_rate_bpm"] = index * 0.000001
    payload["measurements"]["heart_rate_bpm"] = 0.000002
    metric = post(client, payload).json()["metrics"]["heart_rate_bpm"]
    assert metric["status"] == "analyzed"
    assert metric["baseline"]["mad"] == 0
    assert metric["deviation"]["robust_z_score"] == 0
