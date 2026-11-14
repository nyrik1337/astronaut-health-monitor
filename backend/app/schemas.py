"""Request validation and response shapes from docs/API_CONTRACT.md."""

import math
from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, Field, StringConstraints
from pydantic_core import PydanticCustomError


def measurement(value):
    if value is None:
        return None
    try:
        valid = type(value) in (int, float) and math.isfinite(value)
    except OverflowError:
        valid = False
    if not valid:
        raise PydanticCustomError(
            "INVALID_MEASUREMENT",
            "Measurement values must be finite JSON numbers or null.",
        )
    return value


def timestamp(value):
    try:
        if not isinstance(value, str) or len(value) < 11 or value[10] not in "Tt":
            raise ValueError
        parsed = datetime.fromisoformat(value.replace("t", "T").replace("z", "Z"))
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise ValueError
        return parsed.astimezone(timezone.utc)
    except (ValueError, OverflowError):
        raise PydanticCustomError(
            "INVALID_TIMESTAMP", "Timestamp must be ISO 8601 with an explicit timezone."
        ) from None


MetricName = Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9_]{0,63}$")]
Measurement = Annotated[float | None, BeforeValidator(measurement)]
Timestamp = Annotated[datetime, BeforeValidator(timestamp)]


class HistoricalRecord(BaseModel):
    timestamp: Timestamp
    measurements: dict[MetricName, Measurement] = Field(max_length=64)


class AnalyzeRequest(BaseModel):
    subject_id: str = Field(strict=True, min_length=1, max_length=128)
    timestamp: Timestamp
    measurements: dict[MetricName, Measurement] = Field(min_length=1, max_length=64)
    history: list[HistoricalRecord] = Field(max_length=1000)


class Baseline(BaseModel):
    median: float = Field(allow_inf_nan=False)
    mad: float = Field(allow_inf_nan=False)
    scaled_mad: float = Field(allow_inf_nan=False)


class Deviation(BaseModel):
    absolute: float = Field(allow_inf_nan=False)
    robust_z_score: float | None = Field(allow_inf_nan=False)


class MetricResult(BaseModel):
    current: float | None
    status: Literal["analyzed", "zero_variability", "insufficient_history", "missing_current"]
    history_samples: int
    baseline: Baseline | None
    deviation: Deviation | None


class Warning(BaseModel):
    code: Literal["ZERO_BASELINE_VARIABILITY", "INSUFFICIENT_HISTORY", "NO_CURRENT_DATA"]
    metric: str | None
    message: str


class AnalyzeResponse(BaseModel):
    subject_id: str
    timestamp: datetime
    analysis_status: Literal["complete", "partial", "insufficient_history", "no_current_data"]
    baseline_method: Literal["median_mad"] = "median_mad"
    minimum_history_samples: Literal[5] = 5
    metrics: dict[str, MetricResult]
    warnings: list[Warning]
    disclaimer: str
