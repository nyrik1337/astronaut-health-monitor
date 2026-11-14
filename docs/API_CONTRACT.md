# Astronaut Health Monitor MVP API Contract

Status: Approved MVP contract

API version: `0.1.0`

This document is the shared contract between the FastAPI backend and the React frontend. The frontend TypeScript types must follow the JSON fields and status values defined here.

The API describes how a current measurement differs from the personal history submitted with the request. It does not produce medical diagnoses, medical severity classifications, health declarations, or comparisons against absolute clinical thresholds.

## Service behavior

- The backend is stateless and does not retain subject measurements.
- The React frontend retains the raw history locally, submits it for analysis, and uses the returned median as the chart's personal-baseline line.
- The only MVP endpoints are `GET /health` and `POST /api/analyze`.
- CORS allows the origin `http://localhost:5173`.
- The initial demo metrics are:
  - `heart_rate_bpm`
  - `spo2_percent`
  - `body_temperature_c`
- Other valid metric names remain supported.

## Common conventions

### Timestamps

All request timestamps must be ISO 8601 timestamps with an explicit timezone. Response timestamps are normalized to UTC and use the `Z` suffix.

### Metric names

A metric name must:

- use lowercase snake case;
- begin with a lowercase letter;
- contain only lowercase letters, digits, and underscores;
- be between 1 and 64 characters; and
- include the unit in its name where practical.

The exact validation pattern is:

```text
^[a-z][a-z0-9_]{0,63}$
```

### Measurement values

A measurement value must be a finite JSON number or `null`. Strings, booleans, objects, arrays, `NaN`, and positive or negative infinity are invalid. The API does not validate measurements against physiological or clinical ranges.

## `GET /health`

This endpoint is a process-readiness check. It does not run an analysis and does not check optional integrations such as Ollama.

### Successful response

Status: `200 OK`

```json
{
  "status": "ok",
  "service": "astronaut-health-monitor",
  "version": "0.1.0"
}
```

## `POST /api/analyze`

The endpoint calculates a personal baseline independently for every metric present in the current `measurements` object.

### Request example

```json
{
  "subject_id": "crew-01",
  "timestamp": "2026-10-04T14:30:00Z",
  "measurements": {
    "heart_rate_bpm": 74,
    "spo2_percent": 98,
    "body_temperature_c": 36.7
  },
  "history": [
    {
      "timestamp": "2026-10-04T09:30:00Z",
      "measurements": {
        "heart_rate_bpm": 68,
        "spo2_percent": 98,
        "body_temperature_c": 36.5
      }
    },
    {
      "timestamp": "2026-10-04T10:30:00Z",
      "measurements": {
        "heart_rate_bpm": 70,
        "spo2_percent": 97,
        "body_temperature_c": 36.6
      }
    },
    {
      "timestamp": "2026-10-04T11:30:00Z",
      "measurements": {
        "heart_rate_bpm": 72,
        "spo2_percent": 98,
        "body_temperature_c": null
      }
    },
    {
      "timestamp": "2026-10-04T12:30:00Z",
      "measurements": {
        "heart_rate_bpm": 69,
        "spo2_percent": 99,
        "body_temperature_c": 36.4
      }
    },
    {
      "timestamp": "2026-10-04T13:30:00Z",
      "measurements": {
        "heart_rate_bpm": 71,
        "spo2_percent": 98,
        "body_temperature_c": 36.5
      }
    }
  ]
}
```

### Request fields and limits

| Field | Requirements |
| --- | --- |
| `subject_id` | Required string, 1 to 128 characters. It is an opaque identifier. |
| `timestamp` | Required timezone-aware ISO 8601 timestamp for the current measurements. |
| `measurements` | Required object containing 1 to 64 valid metric keys. Values are finite numbers or `null`. |
| `history` | Required array containing 0 to 1,000 records. |
| `history[].timestamp` | Required timezone-aware ISO 8601 timestamp. |
| `history[].measurements` | Required object containing 0 to 64 valid metric keys. It may be empty when sensors were unavailable. Values are finite numbers or `null`. |

Additional request rules:

- `Content-Type` must be `application/json`.
- The maximum request body size is 1,048,576 bytes (1 MiB).
- Historical timestamps must be unique.
- Historical records must be supplied in strictly ascending timestamp order.
- Every historical timestamp must occur before the current request timestamp.
- A metric may be absent from an individual historical record.
- Historical metrics that are not present in the current `measurements` object are not analyzed.

### Successful response example

Status: `200 OK`

```json
{
  "subject_id": "crew-01",
  "timestamp": "2026-10-04T14:30:00Z",
  "analysis_status": "partial",
  "baseline_method": "median_mad",
  "minimum_history_samples": 5,
  "metrics": {
    "heart_rate_bpm": {
      "current": 74.0,
      "status": "analyzed",
      "history_samples": 5,
      "baseline": {
        "median": 70.0,
        "mad": 1.0,
        "scaled_mad": 1.4826
      },
      "deviation": {
        "absolute": 4.0,
        "robust_z_score": 2.697
      }
    },
    "spo2_percent": {
      "current": 98.0,
      "status": "zero_variability",
      "history_samples": 5,
      "baseline": {
        "median": 98.0,
        "mad": 0.0,
        "scaled_mad": 0.0
      },
      "deviation": {
        "absolute": 0.0,
        "robust_z_score": null
      }
    },
    "body_temperature_c": {
      "current": 36.7,
      "status": "insufficient_history",
      "history_samples": 4,
      "baseline": null,
      "deviation": null
    }
  },
  "warnings": [
    {
      "code": "ZERO_BASELINE_VARIABILITY",
      "metric": "spo2_percent",
      "message": "A standardized deviation cannot be calculated because the median absolute deviation is zero."
    },
    {
      "code": "INSUFFICIENT_HISTORY",
      "metric": "body_temperature_c",
      "message": "At least 5 valid historical values are required for this demonstration; 4 were supplied."
    }
  ],
  "disclaimer": "This demonstration describes deviation from submitted personal history. Five readings do not establish clinical reliability, and the result is not a medical diagnosis."
}
```

Derived numeric values are rounded to three decimal places. `scaled_mad` may retain four decimal places to represent the `1.4826` scale factor. Calculations use full precision internally. JSON responses never contain `NaN` or infinity.

## Personal baseline calculation

The backend processes each key in the current `measurements` object independently:

1. Select historical values with the same metric name.
2. Exclude absent and `null` historical values for that metric.
3. Exclude the current value from its own baseline.
4. Count the remaining values and require at least five.
5. Calculate the median `m`:

   ```text
   m = median(x)
   ```

6. Calculate the median absolute deviation:

   ```text
   MAD = median(abs(x_i - m))
   ```

7. Calculate scaled MAD:

   ```text
   scaledMAD = 1.4826 * MAD
   ```

8. When `scaledMAD` is greater than zero, calculate the signed robust Z-score:

   ```text
   robustZ = (current - m) / scaledMAD
   ```

9. Calculate absolute deviation:

   ```text
   absolute = abs(current - m)
   ```

Five readings is a demonstration-only data-sufficiency rule for the hackathon MVP. It prevents the UI from presenting calculations for extremely sparse input. It is not evidence that five readings create a stable, clinically meaningful, or clinically reliable baseline.

## Metric statuses

Every key present in current `measurements` appears in the response's `metrics` object and has exactly one of these statuses:

| Status | Meaning | Counts as baseline-analyzed? |
| --- | --- | --- |
| `analyzed` | The current value is numeric, at least five valid historical values exist, and MAD is greater than zero. | Yes |
| `zero_variability` | The current value is numeric, at least five valid historical values exist, and MAD is zero. | Yes |
| `insufficient_history` | The current value is numeric, but fewer than five valid historical values exist. | No |
| `missing_current` | The current value is `null`. | No |

For `missing_current`, `baseline` and `deviation` are `null`. History is not used to produce a baseline when there is no numeric current value, but `history_samples` still reports the count of valid historical values for that metric.

For `insufficient_history`, `baseline` and `deviation` are `null`.

## Overall analysis statuses

The overall `analysis_status` considers every metric key in the current `measurements` object:

| Status | Exact rule |
| --- | --- |
| `complete` | Every metric is `analyzed` or `zero_variability`. |
| `partial` | At least one metric is `analyzed` or `zero_variability`, and at least one metric is `missing_current` or `insufficient_history`. |
| `insufficient_history` | At least one current value is numeric, but no metric is `analyzed` or `zero_variability`. |
| `no_current_data` | All current measurement values are `null`, regardless of submitted history. |

`zero_variability` therefore counts as analyzed for the overall status, while `missing_current` does not.

### Completely null current measurements

Request:

```json
{
  "subject_id": "crew-01",
  "timestamp": "2026-10-04T14:30:00Z",
  "measurements": {
    "heart_rate_bpm": null,
    "spo2_percent": null,
    "body_temperature_c": null
  },
  "history": []
}
```

Response: `200 OK`

```json
{
  "subject_id": "crew-01",
  "timestamp": "2026-10-04T14:30:00Z",
  "analysis_status": "no_current_data",
  "baseline_method": "median_mad",
  "minimum_history_samples": 5,
  "metrics": {
    "heart_rate_bpm": {
      "current": null,
      "status": "missing_current",
      "history_samples": 0,
      "baseline": null,
      "deviation": null
    },
    "spo2_percent": {
      "current": null,
      "status": "missing_current",
      "history_samples": 0,
      "baseline": null,
      "deviation": null
    },
    "body_temperature_c": {
      "current": null,
      "status": "missing_current",
      "history_samples": 0,
      "baseline": null,
      "deviation": null
    }
  },
  "warnings": [
    {
      "code": "NO_CURRENT_DATA",
      "metric": null,
      "message": "All current measurement values are null."
    }
  ],
  "disclaimer": "This demonstration describes deviation from submitted personal history. Five readings do not establish clinical reliability, and the result is not a medical diagnosis."
}
```

## Zero MAD with non-identical samples

MAD measures the median distance from the median; it does not test whether every sample is identical. For this history:

```json
[98, 98, 98, 99, 100]
```

the median is `98`, and the absolute deviations are:

```json
[0, 0, 0, 1, 2]
```

Their median is zero. Thus, MAD can be zero even though some samples differ, particularly when at least half of the values are concentrated at the median.

The backend does not divide by zero or substitute invented variability. A metric result in this case is:

```json
{
  "current": 99.0,
  "status": "zero_variability",
  "history_samples": 5,
  "baseline": {
    "median": 98.0,
    "mad": 0.0,
    "scaled_mad": 0.0
  },
  "deviation": {
    "absolute": 1.0,
    "robust_z_score": null
  }
}
```

The baseline median and absolute deviation remain usable, so `zero_variability` counts as baseline-analyzed. Only the standardized score is unavailable.

## Warnings

`warnings` is always an array and may be empty. Each warning has exactly these fields:

```json
{
  "code": "INSUFFICIENT_HISTORY",
  "metric": "body_temperature_c",
  "message": "At least 5 valid historical values are required for this demonstration; 4 were supplied."
}
```

`metric` is a metric name or `null` for a request-level warning. The defined MVP warning codes are:

- `ZERO_BASELINE_VARIABILITY`: emitted for each `zero_variability` metric.
- `INSUFFICIENT_HISTORY`: emitted for each `insufficient_history` metric.
- `NO_CURRENT_DATA`: emitted once when `analysis_status` is `no_current_data`.

A `missing_current` metric in a mixed request is represented by its metric status and does not add a separate warning.

## Validation and errors

### Error envelope

All error responses use this top-level format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": []
  }
}
```

Each validation detail uses:

```json
{
  "field": "history.2.timestamp",
  "code": "DUPLICATE_TIMESTAMP",
  "message": "Historical timestamps must be unique."
}
```

The `field` path uses dot-separated JSON field names and zero-based array indexes. Multiple detectable validation problems may be returned together in `details`.

### Validation failures

All structurally or semantically invalid, well-formed JSON analysis requests return `422 Unprocessable Entity`. This policy includes:

- duplicate historical timestamps;
- historical timestamps out of array order;
- historical timestamps equal to or later than the current timestamp;
- timestamps without explicit timezones;
- invalid metric names;
- invalid measurement values;
- empty current `measurements`;
- more than 64 current metrics;
- more than 64 metrics in a historical record;
- more than 1,000 historical records; and
- missing required fields.

#### Duplicate and out-of-order timestamps

Response: `422 Unprocessable Entity`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "field": "history.2.timestamp",
        "code": "DUPLICATE_TIMESTAMP",
        "message": "Historical timestamps must be unique."
      },
      {
        "field": "history.3.timestamp",
        "code": "TIMESTAMP_OUT_OF_ORDER",
        "message": "Historical timestamps must be strictly ascending."
      }
    ]
  }
}
```

#### Invalid measurement values

Invalid request fragment:

```json
{
  "measurements": {
    "heart_rate_bpm": true,
    "spo2_percent": "98"
  }
}
```

Response: `422 Unprocessable Entity`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "field": "measurements.heart_rate_bpm",
        "code": "INVALID_MEASUREMENT",
        "message": "Measurement values must be finite JSON numbers or null."
      },
      {
        "field": "measurements.spo2_percent",
        "code": "INVALID_MEASUREMENT",
        "message": "Measurement values must be finite JSON numbers or null."
      }
    ]
  }
}
```

#### History limit

Response: `422 Unprocessable Entity`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "field": "history",
        "code": "HISTORY_LIMIT_EXCEEDED",
        "message": "History may contain at most 1000 records."
      }
    ]
  }
}
```

### Malformed JSON

Response: `400 Bad Request`

```json
{
  "error": {
    "code": "MALFORMED_JSON",
    "message": "Request body is not valid JSON.",
    "details": []
  }
}
```

### Request body too large

Any request body larger than 1,048,576 bytes receives `413 Content Too Large`:

```json
{
  "error": {
    "code": "REQUEST_TOO_LARGE",
    "message": "Request body must not exceed 1048576 bytes.",
    "details": []
  }
}
```

### Unsupported media type

Response: `415 Unsupported Media Type`

```json
{
  "error": {
    "code": "UNSUPPORTED_MEDIA_TYPE",
    "message": "Content-Type must be application/json.",
    "details": []
  }
}
```

### Unexpected server error

Unexpected failures do not expose exception messages or tracebacks.

Response: `500 Internal Server Error`

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "The analysis could not be completed.",
    "details": []
  }
}
```

Insufficient history, missing current values, and zero MAD are valid analysis outcomes. They return `200 OK`, not error responses.

## Frontend history ownership

Because the backend is stateless, the React frontend must retain the raw time series that it wants to chart or submit again. At minimum it retains:

```json
{
  "subject_id": "crew-01",
  "history": [
    {
      "timestamp": "2026-10-04T13:30:00Z",
      "measurements": {
        "heart_rate_bpm": 71,
        "spo2_percent": 98,
        "body_temperature_c": 36.5
      }
    }
  ]
}
```

The frontend retains:

- the current `subject_id`;
- each sample's timezone-aware timestamp;
- raw measurement values, including `null` values;
- metric names, including their display units;
- the latest current reading when it should appear as the newest chart point; and
- optionally, the most recent analysis response for annotations.

The frontend appends new readings, keeps them in chronological order, and submits no more than the latest 1,000 records. It draws each baseline line from `metrics.<metric>.baseline.median` when that baseline is non-null. It must not attempt to reconstruct raw history from the analysis response because the response contains aggregates only.

## Additive extension: Evidence Navigator and CognitiveGuard

Status: **Design approved for the hackathon MVP; implementation pending. Final contract PR requires human review and merge.**
Extension revision: `evidence-cognitive-1`. Everything above this heading remains
the approved MVP v0.1.0 contract. The two additive routes below do not change
`GET /health`, its version, `POST /api/analyze`, or any existing status, validation,
warning, or error meaning. Rules below apply only to the additive routes.

Both routes remain stateless, synchronous request/response operations. No storage,
authentication, diagnostic model, ML, LLM, treatment decision, or clinical alarm
engine is added. Client provenance is an assertion, not authenticated device evidence.
No confidence/accuracy percentage, diagnosis, fitness-for-duty conclusion, or causal
sleep/fatigue interpretation is returned.

### Shared extension schemas and modes

The following structural notation specifies the complete wire schemas: all fields
are required, including nullable fields; `?` is not used; arrays have the limits
specified below; unknown fields at every level are rejected. Literals are exact
case-sensitive strings. `number` means a finite JSON number (never a boolean or
numeric string); `integer` means a JSON integer. IDs are strings of 1–128 characters;
text is plain text of 1–500 characters. Output prose is illustrative, but field
names, types, enums, arithmetic, and status rules are normative for this extension.

```typescript
type Mode = "simulation" | "real_assessment";
type Provenance = "simulated" | "browser_measured" | "real_device"
  | "human_entered" | "research_dataset";
type Clock = { kind: "mission" | "utc"; id: string };
type Source = { kind: Provenance; source_id: string | null };
type Quality = { status: "unknown" | "acceptable" | "poor"; reasons: string[] };
type NoticeInput = { id: string; reported_at: Timestamp; source: Source; text: string };
type NoticeOutput = NoticeInput & { verification: "unverified_client_input" };
type NextCheck = { code: "sleep_check_in" | "reaction_time_check"
  | "collect_comparable_history" | "repeat_uninterrupted"; optional: true };
type Policy = {
  version: "demo-1";
  freshness_seconds: { heart_rate: 900; sleep_duration: 129600; cognitive_test: 86400 };
  history_max_age_seconds: 2592000;
  familiarization_sessions: 2;
  minimum_baseline_sessions: 3;
  minimum_valid_trials: 16;
};
```

`Timestamp` is a valid Gregorian RFC 3339 string in the form
`YYYY-MM-DDTHH:mm:ss[.fraction](Z|+HH:mm|-HH:mm)`, with 0–3 fractional digits,
years 0001–9999, seconds 00–59, and an explicit numeric offset or Z.
Reject impossible dates, leap seconds, timezone-free values, and unknown offset
`-00:00`. Compare instants after UTC normalization; responses use Z.
Duplicate timestamps mean duplicate instants, even if textual offsets differ.

- `simulation` requires `clock.kind="mission"` and a mission-specific `clock.id`.
  All issue, observation, notice, and cognitive-session sources must be `simulated`.
  `as_of` is the mission clock; do not compare it to server wall time.
- `real_assessment` requires `clock={"kind":"utc","id":"utc"}`.
  `as_of` must be within 300 seconds (inclusive) of server UTC receipt time.
  Freeze receipt time once per request; tests inject it. This tolerance only checks
  the client clock: it never permits an observation later than `as_of`.
- Every issue/observation/notice timestamp and every test's start/end timestamp must
  be <= `as_of`, with no future-observation grace period. End >= start.
  Exactly `as_of` is allowed. Freshness is `as_of - observed_at` (test end for
  cognitive results); stale means age strictly greater than its limit.
- Each cognitive session includes its own subject and clock. All sessions must match
  the enclosing subject and clock; reject mismatch, never silently reassign identity
  or shift timestamps. History ends strictly before the current session starts and
  is ordered by strictly increasing end time. Session IDs and end instants are unique.
- In real evidence assessment, sources may be `real_device`, `human_entered`, or
  `browser_measured`; cognitive evidence must be `browser_measured`.
  Research datasets have no supported real-subject linkage in this revision and are
  rejected in either mode, even though the shared provenance vocabulary reserves them.
- In real cognitive analysis, current and historical sessions must all be
  `browser_measured`. Manual entries, device imports, research datasets, and synthetic
  sessions cannot form its baseline. A mixed-provenance request is 422; a correctly
  filtered real request with no eligible baseline is 200 `insufficient_history`.
- `browser_measured` means browser-generated timing data; `human_entered` means
  manually supplied data. Do not relabel one as the other. `source_id` is nullable
  except for `research_dataset`, which requires a dataset identifier. It is not proof
  of trust. Clients cannot request a medically verified warning designation.

The frontend must maintain distinct subject/history stores for real participants and
synthetic mission subjects. Launching a real test from the mission UI creates a real
assessment context with actual UTC time and a participant ID. Its result must not be
inserted into the synthetic astronaut's history or used to resolve that astronaut's
missing cognitive evidence. A separately labeled synthetic test can demonstrate
mission reassessment. The UI can show the real participant result alongside that
demonstration only with clear identity and mode labels.

### Operational policy, warnings, and common limits

`demo-1` has the exact defaults in `Policy` above. These are configurable operational
demo assumptions, not NASA-validated or clinical thresholds. The 20-trial protocol,
minimum 16 valid trials, two familiarization sessions, and three subsequent baseline
sessions are configurable demo assumptions, fixed for these published versions.
A deployment policy change must
receive a new version and an approved contract update; clients cannot override policy
per request. Responses echo the complete effective policy. Test protocol changes
separately require a new `test_version`.

Evidence freshness and baseline eligibility use independent windows. The 24-hour
cognitive freshness window describes relevance to a current fatigue assessment,
measured against as_of. The 30-day history window selects prior sessions relative
to current_test.started_at. For example, a usable matching test from two days ago
is stale as current evidence but can still be a baseline measurement. Do not copy
a previous response's stale_data status into history quality or apply the 24-hour
window to history. Re-evaluate raw sessions under the history rules; history_expired
is the exclusion reason for exceeding the 30-day window, not stale_data.

Unknown quality is not acceptable quality: return it explicitly and disclose that
acquisition quality was not supplied. Missing values are never replaced with zero;
stale values remain stale even if numerically ordinary. Warnings and quality are
independent: every supplied notice is echoed in input order as unverified, including
when all evidence is missing, stale, or poor. Do not suppress existing UI/device safety
alerts when displaying these responses. This API cannot authenticate or medically
verify client notices and has no trusted warning integration in this revision.

Both routes require JSON and the existing 1,048,576-byte streamed-body ceiling.
Extension limits: 16 notices; 8 quality reasons; 100 historical sessions; 20 trials per
session; 10 returned explanation strings per category, each <=500 characters.
Reasons and notice text are plain text, never rendered as HTML. No truncation on input:
over-limit requests are rejected. Subject IDs are opaque; no personal names required.

### POST /api/evidence/assess

```typescript
type EvidenceKind = "heart_rate" | "sleep_duration" | "cognitive_test";
type EvidenceStatus = "available" | "missing_data" | "stale_data" | "poor_quality";
type Observation = {
  kind: EvidenceKind;
  observed_at: Timestamp;
  value: number | null;
  source: Source;
  quality: Quality;
};
type EvidenceRequest = {
  subject_id: string; mode: Mode; clock: Clock; as_of: Timestamp;
  reported_issue: { code: "fatigue"; reported_at: Timestamp; source: Source };
  observations: Observation[];
  notices: NoticeInput[];
};
type EvidenceItem = {
  kind: EvidenceKind; status: EvidenceStatus; observed_at: Timestamp | null;
  value: number | null; source: Source | null; quality: Quality | null;
  age_seconds: number | null;
  issues: ("missing_data" | "stale_data" | "poor_quality" | "quality_unknown")[];
};
type EvidenceResponse = {
  subject_id: string; mode: Mode; clock: Clock; as_of: Timestamp;
  interpretation: "synthetic_demonstration" | "evidence_inventory";
  policy: Policy;
  assessment_status: "complete" | "missing_data" | "stale_data" | "poor_quality" | "mixed";
  evidence: EvidenceItem[];
  what_data_show: string[]; unknowns: string[]; limitations: string[];
  next_checks: NextCheck[]; notices: NoticeOutput[];
};
```

Supply 0–3 observations, at most one per kind (duplicate kind is invalid).
Units are fixed: heart rate in bpm, sleep in hours over the preceding 24 hours ending
at `observed_at`, cognitive value in milliseconds (the current session median returned
by CognitiveGuard). Heart rate must be >0, sleep 0–24, cognitive median >0 and <=1500,
or any value may be null. These are data/protocol bounds, not clinical ranges.
Quality `poor` requires at least one reason; `unknown`/`acceptable` require empty reasons.
A cognitive inventory observation is a client-supplied summary, not proof of a valid
baseline or a verified CognitiveGuard result. Unknown quality cannot be upgraded by
the backend.

Return exactly three evidence items ordered heart_rate, sleep_duration, cognitive_test.
Absent observation: null fields, `missing_data`. Present null value is also missing,
but retain its supplied timestamp/source/quality. Collect all applicable issues in
the enum order above. Primary status precedence: missing > stale > poor > available;
quality_unknown is a limitation, not a numeric normality claim.
Overall status is complete when all primary statuses are available; otherwise use the
one distinct non-available primary status, or mixed if there are two or more.
Complete means the inventory is populated, never that fatigue is explained.

Always explain that heart rate alone cannot explain reported fatigue; never label
pulse clinically normal. For unavailable sleep, offer sleep_check_in; for unavailable
cognitive evidence, offer reaction_time_check. Return checks in that order. A recent
usable cognitive summary removes that offer even if its longitudinal baseline was
insufficient; it does not create a longitudinal conclusion. Checks are voluntary.

Example request (synthetic mission; independent of wall time):

```json
{
  "subject_id": "sim-crew-01", "mode": "simulation",
  "clock": {"kind": "mission", "id": "mission-500"}, "as_of": "2026-11-14T10:00:00Z",
  "reported_issue": {"code": "fatigue", "reported_at": "2026-11-14T09:58:00Z", "source": {"kind": "simulated", "source_id": "mission-500"}},
  "observations": [
    {"kind": "heart_rate", "observed_at": "2026-11-14T09:55:00Z", "value": 72, "source": {"kind": "simulated", "source_id": "mission-500"}, "quality": {"status": "unknown", "reasons": []}}
  ],
  "notices": []
}
```

Response (200):

```json
{
  "subject_id": "sim-crew-01", "mode": "simulation",
  "clock": {"kind": "mission", "id": "mission-500"}, "as_of": "2026-11-14T10:00:00Z",
  "interpretation": "synthetic_demonstration",
  "policy": {"version": "demo-1", "freshness_seconds": {"heart_rate": 900, "sleep_duration": 129600, "cognitive_test": 86400}, "history_max_age_seconds": 2592000, "familiarization_sessions": 2, "minimum_baseline_sessions": 3, "minimum_valid_trials": 16},
  "assessment_status": "missing_data",
  "evidence": [
    {"kind": "heart_rate", "status": "available", "observed_at": "2026-11-14T09:55:00Z", "value": 72, "source": {"kind": "simulated", "source_id": "mission-500"}, "quality": {"status": "unknown", "reasons": []}, "age_seconds": 300, "issues": ["quality_unknown"]},
    {"kind": "sleep_duration", "status": "missing_data", "observed_at": null, "value": null, "source": null, "quality": null, "age_seconds": null, "issues": ["missing_data"]},
    {"kind": "cognitive_test", "status": "missing_data", "observed_at": null, "value": null, "source": null, "quality": null, "age_seconds": null, "issues": ["missing_data"]}
  ],
  "what_data_show": ["The synthetic heart-rate observation is 72 bpm and 300 seconds old."],
  "unknowns": ["Recent sleep duration and reaction-time evidence are missing.", "Heart-rate acquisition quality is unknown."],
  "limitations": ["Synthetic demonstration only.", "Heart rate alone cannot explain reported fatigue. This inventory is not a diagnosis."],
  "next_checks": [{"code": "sleep_check_in", "optional": true}, {"code": "reaction_time_check", "optional": true}],
  "notices": []
}
```

### Fixed experimental protocol: orbita-rt-1

This is an experimental ORBITA reaction-time check, **not a clinically validated
PVT, NASA PVT+, or ISS Reaction Self Test**. It has no clinical accuracy claim.

- Desktop/laptop, visual stimulus, Space key only; touch/mobile unsupported in v1.
  Instructions and an explicit start action precede a 3,000 ms countdown.
- Exactly 20 scored trials. Each begins with an independently randomized integer
  wait of 1,000–3,000 ms inclusive. Then display one high-contrast visual target.
  Use a rendering-frame callback to schedule display and record the software onset
  with performance.now(); use the same clock in the keydown handler.
  The recorded onset is not a measured physical display onset.
- First non-repeat Space keydown terminates a trial. A keydown before onset is
  early; a response with elapsed time <100 ms is also early. A response in
  [100,1500] ms is valid. No response by the 1,500 ms deadline is missed.
  Deadline wins when a handler executes after 1,500 ms. Never replace missed/early
  trials or silently discard slow valid trials. Ignore key-repeat events.
- After each outcome, use a 500 ms inter-trial interval (none after trial 20).
  Require key release before the next trial; a held key aborts that attempt.
  Trial counts therefore always reconcile: valid + early + missed = completed trials.
- Any visibility loss, window blur, user cancellation, held key, or detected
  scheduler gap >250 ms during the active attempt aborts it immediately. Monitor gaps
  with the rendering-frame loop. Return only completed trials; never resume the same
  session or fill unperformed trials with misses. A new attempt gets a new session ID.
- For real attempts, store start/end UTC instants separately from monotonic elapsed
  timings; never use network round-trip time or wall-clock subtraction as reaction
  time. Synthetic fixtures use their mission clock for start/end, never redate a
  participant's browser result to mission time.
- Latency from display, input device, browser scheduling and timer precision is
  uncalibrated. No numerical latency subtraction or claimed biological accuracy.
  Few trials, practice, distraction, changing setup and unobserved context limit
  comparisons. Two familiarization sessions cannot prove practice effects eliminated.

### POST /api/cognitive/analyze

```typescript
type Trial = {
  index: integer; wait_ms: integer;
  outcome: "response" | "early" | "missed";
  reaction_time_ms: number | null;
};
type Session = {
  session_id: string; subject_id: string; clock: Clock;
  test_version: "orbita-rt-1"; phase: "familiarization" | "measurement";
  started_at: Timestamp; ended_at: Timestamp; source: Source;
  context: {
    setup_id: string; device_class: "desktop" | "laptop";
    browser_family: "chrome" | "edge" | "firefox" | "safari";
    browser_version: string; os_family: "windows" | "macos" | "linux";
    os_version: string;
    input_method: "keyboard_space"; timing_api: "performance_now";
  };
  completion: "completed" | "aborted";
  interruptions: ("visibility_lost" | "window_blur" | "cancelled" | "held_key" | "scheduler_gap")[];
  trials: Trial[];
};
type CognitiveRequest = {
  subject_id: string; mode: Mode; clock: Clock; as_of: Timestamp;
  current_test: Session; history: Session[];
  context_observations: Observation[];
  notices: NoticeInput[];
};
type Summary = {
  valid_trials: integer; missed_responses: integer; early_responses: integer;
  median_reaction_time_ms: number | null; p90_reaction_time_ms: number | null;
};
type CognitiveResponse = {
  subject_id: string; mode: Mode; clock: Clock; as_of: Timestamp;
  session_id: string; timestamp: Timestamp; test_version: "orbita-rt-1";
  interpretation: "synthetic_demonstration" | "experimental_personal_summary";
  policy: Policy;
  analysis_status: "analyzed" | "insufficient_history" | "missing_data" | "poor_quality" | "stale_data";
  issues: ("missing_data" | "stale_data" | "poor_quality" | "familiarization" | "insufficient_history")[];
  current: Summary;
  baseline: {
    session_ids: string[]; median_reaction_time_ms: number; signed_difference_ms: number;
  } | null;
  history_evaluation: {
    session_id: string;
    disposition: "baseline" | "familiarization" | "excluded";
    reasons: ("context_mismatch" | "poor_quality" | "history_expired" | "familiarization_incomplete")[];
  }[];
  context_observations: EvidenceItem[];
  what_data_show: string[]; limitations: string[];
  next_checks: NextCheck[]; notices: NoticeOutput[];
};
```

Context strings are 1–128 characters. setup_id is a random locally retained identifier
for the same physical computer, display, keyboard and setup; rotate it on hardware
changes (no fingerprinting). Preserve the full reported browser/OS versions for audit.
Version strings must match ^[0-9]+(\.[0-9]+){0,3}$ (1–4 numeric components, <=128
characters); the major version is the numeric first component, ignoring leading zeros.
Comparison requires identical setup_id, device_class, browser_family, os_family,
input_method, timing_api, test_version, and browser/OS major versions. Minor, patch
and build components are recorded but do not exclude history. For example, Chrome
131.0.6778.85 and 131.0.6778.108 can match; Chrome 132 or switching to Firefox cannot.
OS version reporting must use the same convention for a setup; rotate setup_id if
the convention or timing-relevant setup changes. Do not infer compatibility from
version strings alone or silently substitute unknown metadata. Unsupported families
or missing versions fail validation; broader platform support is deferred.

This is a pragmatic demo compatibility policy, not a guarantee of equivalent latency.
Even patch updates can affect timing. Every cognitive response must disclose that
minor/patch updates are tolerated and may affect comparability. Report context_mismatch
for incompatible history; do not reject an otherwise valid request because its
historical context differs. Metadata is client-reported, not hardware calibration.

Trials have consecutive indexes 1..N and wait_ms in [1000,3000].
Response outcome requires reaction_time_ms in [100,1500]; early/missed require null.
Early means premature input, not a clinical inference. Counts are derived on the
server from outcomes; no separate client count can disagree.
Completed session: exactly 20 trials and no interruptions. Aborted session:
0–19 trials and at least one interruption, with unique interruption codes.
A session with fewer than 16 valid responses or an aborted attempt is poor quality;
valid slow responses alone do not make an otherwise complete session poor quality.
Session duration must be <=150 seconds; completed duration must be >=12.5 seconds
(countdown plus inter-trial intervals). These are broad protocol-consistency bounds,
not proof of correct browser acquisition.

History has 0–100 raw sessions. Context observations allow only sleep_duration
and heart_rate (0–2, unique kinds); the same evidence validation/status rules apply.
Fatigue is recorded via Evidence Navigator's reported_issue. Context observations
are echoed as evidence items in input order, never used to select a more favorable
baseline or infer causality.

Baseline selection (deterministic, no learned model):

1. Exclude mismatched-context, poor-quality or historical sessions whose end is more
   than 30 days before current_test.started_at. Return all applicable exclusion reasons
   in the order context_mismatch, poor_quality, history_expired, familiarization_incomplete.
2. Two usable, matching familiarization sessions must precede a measurement session
   for it to be eligible: both must end strictly before that measurement starts.
   Only qualifying familiarization sessions still in the supplied
   30-day window count. Include those raw sessions in each request; missing history
   cannot be replaced with an asserted lifetime count.
3. Familiarization sessions are never baseline measurements. For every usable historical
   measurement lacking two earlier qualifying familiarization sessions, add
   familiarization_incomplete. History evaluation includes one entry per input session,
   in input order: excluded if any reason applies, otherwise familiarization or baseline.
4. Require at least three eligible measurement sessions before the current measurement,
   and two earlier usable familiarization sessions for the current measurement.
   Repeated sessions on one day are allowed; the minimum is a demo sufficiency rule,
   not established longitudinal validity. Do not compare the current session to itself.
5. Baseline = median of eligible session medians, weighting each session equally.
   Signed difference = current median minus baseline. Report all eligible IDs.
   Current p90 uses sorted valid responses at index ceil(0.9*n), with 1-based indexing.
   Use full precision internally; round derived millisecond values to 3 decimals.
   Do not compute risk, impairment labels, standardized scores, or confidence percentages.

Current status precedence: missing_data (zero valid responses), stale_data (end >24h
before as_of), poor_quality (as defined above), insufficient_history (current phase
familiarization, missing familiarization, or fewer than three baseline measurements),
otherwise analyzed. issues retains every applicable condition in its declared order.
baseline is non-null only for analyzed; summary still reports valid raw-trial statistics
for other statuses, with null median/p90 when no valid trials. A current familiarization
session always includes familiarization and insufficient_history issues.
History insufficiency is evaluated independently of current quality.

Next checks: missing_data/poor_quality -> repeat_uninterrupted; stale_data ->
reaction_time_check; insufficient_history -> collect_comparable_history; analyzed -> [].
These are optional and must not be represented as a medical instruction.
Always disclose experimental status and uncalibrated timing. Simulated responses must
also say "Synthetic demonstration only"; real responses must disclose incomplete
self-reported history/context and possible practice effects. Supplied sleep/pulse
context is descriptive only and must be accompanied by a non-causality limitation.

Example real request: first measurement, no real baseline. For deterministic replay,
server receipt time is 2026-11-14T10:05:00Z; live clients use current UTC time.

```json
{
  "subject_id": "participant-01", "mode": "real_assessment",
  "clock": {"kind": "utc", "id": "utc"}, "as_of": "2026-11-14T10:05:00Z",
  "current_test": {
    "session_id": "real-001", "subject_id": "participant-01",
    "clock": {"kind": "utc", "id": "utc"},
    "test_version": "orbita-rt-1", "phase": "measurement",
    "started_at": "2026-11-14T10:03:00Z", "ended_at": "2026-11-14T10:04:00Z",
    "source": {"kind": "browser_measured", "source_id": null},
    "context": {"setup_id": "setup-a", "device_class": "laptop", "browser_family": "chrome", "browser_version": "131.0.6778.108", "os_family": "macos", "os_version": "15.1.1", "input_method": "keyboard_space", "timing_api": "performance_now"},
    "completion": "completed", "interruptions": [],
    "trials": [
      {"index": 1, "wait_ms": 2000, "outcome": "response", "reaction_time_ms": 370},
      {"index": 2, "wait_ms": 2000, "outcome": "response", "reaction_time_ms": 370},
      {"index": 3, "wait_ms": 2000, "outcome": "response", "reaction_time_ms": 370},
      {"index": 4, "wait_ms": 2000, "outcome": "response", "reaction_time_ms": 370},
      {"index": 5, "wait_ms": 2000, "outcome": "response", "reaction_time_ms": 370},
      {"index": 6, "wait_ms": 2000, "outcome": "response", "reaction_time_ms": 370},
      {"index": 7, "wait_ms": 2000, "outcome": "response", "reaction_time_ms": 370},
      {"index": 8, "wait_ms": 2000, "outcome": "response", "reaction_time_ms": 370},
      {"index": 9, "wait_ms": 2000, "outcome": "response", "reaction_time_ms": 370},
      {"index": 10, "wait_ms": 2000, "outcome": "response", "reaction_time_ms": 370},
      {"index": 11, "wait_ms": 2000, "outcome": "response", "reaction_time_ms": 370},
      {"index": 12, "wait_ms": 2000, "outcome": "response", "reaction_time_ms": 370},
      {"index": 13, "wait_ms": 2000, "outcome": "response", "reaction_time_ms": 370},
      {"index": 14, "wait_ms": 2000, "outcome": "response", "reaction_time_ms": 370},
      {"index": 15, "wait_ms": 2000, "outcome": "response", "reaction_time_ms": 370},
      {"index": 16, "wait_ms": 2000, "outcome": "response", "reaction_time_ms": 370},
      {"index": 17, "wait_ms": 2000, "outcome": "response", "reaction_time_ms": 370},
      {"index": 18, "wait_ms": 2000, "outcome": "response", "reaction_time_ms": 370},
      {"index": 19, "wait_ms": 2000, "outcome": "response", "reaction_time_ms": 370},
      {"index": 20, "wait_ms": 2000, "outcome": "response", "reaction_time_ms": 370}
    ]
  },
  "history": [], "context_observations": [], "notices": []
}
```

Response (200), even if a separate simulation store contains extensive synthetic history:

```json
{
  "subject_id": "participant-01", "mode": "real_assessment",
  "clock": {"kind": "utc", "id": "utc"}, "as_of": "2026-11-14T10:05:00Z",
  "session_id": "real-001", "timestamp": "2026-11-14T10:04:00Z",
  "test_version": "orbita-rt-1", "interpretation": "experimental_personal_summary",
  "policy": {"version": "demo-1", "freshness_seconds": {"heart_rate": 900, "sleep_duration": 129600, "cognitive_test": 86400}, "history_max_age_seconds": 2592000, "familiarization_sessions": 2, "minimum_baseline_sessions": 3, "minimum_valid_trials": 16},
  "analysis_status": "insufficient_history",
  "issues": ["insufficient_history"],
  "current": {"valid_trials": 20, "missed_responses": 0, "early_responses": 0, "median_reaction_time_ms": 370, "p90_reaction_time_ms": 370},
  "baseline": null, "history_evaluation": [], "context_observations": [],
  "what_data_show": ["The recorded median reaction time was 370 ms.", "No comparable real baseline measurements were supplied."],
  "limitations": ["Experimental ORBITA check; not a clinically validated PVT or NASA test.", "Browser and device timing is uncalibrated.", "Submitted history and context are client assertions and may be incomplete. Practice effects remain possible.", "Minor and patch browser/OS updates are tolerated and may affect comparability."],
  "next_checks": [{"code": "collect_comparable_history", "optional": true}], "notices": []
}
```

Analyzed comparison acceptance fixture: five earlier matching usable sessions, two
familiarization then three measurements with medians 310, 320, 330 ms, and current
median 370 ms. Expected baseline median is 320 and signed difference +50 ms.
In real mode every one of these must be browser_measured from the same participant.
In simulation every one must be simulated with the same mission clock; interpretation
must be synthetic_demonstration. Changing only the current source from simulated to
browser_measured makes that simulated request invalid, never a personal comparison.

### Extension errors and acceptance gates

Reuse the MVP error envelope and 400 MALFORMED_JSON, 413 REQUEST_TOO_LARGE,
415 UNSUPPORTED_MEDIA_TYPE, and sanitized 500 INTERNAL_ERROR behavior. No stack traces.
Well-formed invalid extension requests return 422 VALIDATION_ERROR with detail paths.
Insufficient history, missing data, stale data and poor quality are valid 200 outcomes.

Extension detail codes (MVP codes above remain unchanged):

| Code | Condition |
| --- | --- |
| REQUIRED_FIELD / UNKNOWN_FIELD / INVALID_VALUE / LIMIT_EXCEEDED | Missing required key; extra key; wrong type/enum/range or inconsistent fields; array/string limit. |
| INVALID_TIMESTAMP | Invalid timestamp syntax/date/offset. |
| FUTURE_OBSERVATION | Any supplied event/session timestamp is later than as_of. |
| CLOCK_MISMATCH | Mode and clock disagree or session clock differs from request. |
| AS_OF_OUT_OF_RANGE | Real as_of differs from receipt UTC by >300 seconds. |
| PROVENANCE_MODE_MISMATCH | Source is forbidden for this mode/endpoint. |
| SUBJECT_MISMATCH | Session subject differs from enclosing subject. |
| DUPLICATE_ID / DUPLICATE_TIMESTAMP / TIMESTAMP_OUT_OF_ORDER | Duplicate session ID/end instant or unordered history. |
| TIMESTAMP_NOT_BEFORE_CURRENT | Historical session ends at/after current start. |
| INVALID_SESSION_INTERVAL | End before start or duration outside protocol bounds. |
| DUPLICATE_OBSERVATION | Repeated evidence kind. |
| INVALID_TRIALS | Index, outcome/value, completion, interruption or trial-count inconsistency. |

Errors may contain multiple detectable details; clients must not depend on their order.
Every detail has a field path, one listed code, and explanatory plain-text message.
Example: real current result with a simulated historical session (422):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {"field": "history.0.source.kind", "code": "PROVENANCE_MODE_MISMATCH", "message": "Real cognitive history must be browser_measured."}
    ]
  }
}
```

Example: future evidence, including simulation (422):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {"field": "observations.0.observed_at", "code": "FUTURE_OBSERVATION", "message": "Observation timestamp must not be later than as_of."}
    ]
  }
}
```

Required future implementation checks: unchanged MVP fixtures; mode/provenance and
subject isolation; exact timestamp/freshness boundaries and injected receipt time;
interrupted/early/missed trial accounting; familiarization/context/age exclusions;
patch-version compatibility and major/family/setup mismatch exclusions; a two-day-old
session stale for evidence but eligible for history, and a >30-day history exclusion;
median and p90 arithmetic; complete-history and insufficient-history fixtures;
unverified notice retention under every quality status; body/array limits and errors.
End-to-end demo must demonstrate synthetic reassessment separately from a participant's
real test, whose first result has insufficient_history. Returning to simulation must
restore its mission clock and synthetic identity without copying real observations.

The browser owns raw histories and test timing; the backend owns validation, policy,
comparison arithmetic and explanation rules. Reassess evidence with a matching-mode
current summary only after the cognitive response; abort/supersede obsolete requests.
Keep work bounded (100 sessions x 20 trials), offload calculations from the async loop,
and make no external calls. A failed cognitive request must not stop telemetry.
Frontend integration waits for a human-approved contract commit. Browser collection
and UI files belong to Claude; backend schemas/routes/tests belong to Codex.
