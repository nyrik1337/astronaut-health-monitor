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
