"""Descriptive personal baselines; no clinical interpretation."""

import pandas as pd

from .schemas import AnalyzeRequest, AnalyzeResponse

DISCLAIMER = (
    "This demonstration describes deviation from submitted personal history. "
    "Five readings do not establish clinical reliability, and the result is not a medical diagnosis."
)


def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    metrics = {}
    warnings = []
    for name, current in request.measurements.items():
        values = pd.Series(
            [record.measurements.get(name) for record in request.history], dtype="float64"
        ).dropna()
        count = len(values)
        result = dict(current=current, status="missing_current", history_samples=count,
                      baseline=None, deviation=None)
        if current is None:
            pass
        elif count < 5:
            result["status"] = "insufficient_history"
            warnings.append(dict(
                code="INSUFFICIENT_HISTORY", metric=name,
                message=f"At least 5 valid historical values are required for this demonstration; {count} were supplied.",
            ))
        else:
            median = float(values.median())
            mad = float((values - median).abs().median())
            scaled = 1.4826 * mad
            result["baseline"] = dict(median=round(median, 3), mad=round(mad, 3),
                                      scaled_mad=round(scaled, 4))
            result["deviation"] = dict(absolute=round(abs(current - median), 3),
                                       robust_z_score=None)
            if mad == 0:
                result["status"] = "zero_variability"
                warnings.append(dict(
                    code="ZERO_BASELINE_VARIABILITY", metric=name,
                    message="A standardized deviation cannot be calculated because the median absolute deviation is zero.",
                ))
            else:
                result["status"] = "analyzed"
                result["deviation"]["robust_z_score"] = round((current - median) / scaled, 3)
        metrics[name] = result

    successes = sum(r["status"] in ("analyzed", "zero_variability") for r in metrics.values())
    if all(value is None for value in request.measurements.values()):
        status = "no_current_data"
        warnings.append(dict(code="NO_CURRENT_DATA", metric=None,
                             message="All current measurement values are null."))
    elif successes == len(metrics):
        status = "complete"
    elif successes:
        status = "partial"
    else:
        status = "insufficient_history"
    return AnalyzeResponse(subject_id=request.subject_id, timestamp=request.timestamp,
                           analysis_status=status, metrics=metrics, warnings=warnings,
                           disclaimer=DISCLAIMER)
