# Assistant evidence phrasing follow-up

Status: Implemented on `fix/assistant-evidence-phrasing`, based on main `4e76ed1`.
Human review is required before merge.

## Narrow change

`app/assistant.py` now builds an internal `assessment_facts` summary exclusively
from the recomputed, validated Evidence Navigator and CognitiveGuard response fields.
It states each measurement's value, existing status, and acquisition quality
separately. A missing item cannot erase an available measurement from the summary.
CognitiveGuard context observations remain visible even without an Evidence Navigator
request, and a supplied cognitive result remains distinct from a missing inventory item.

For example, a synthetic heart-rate observation of 62 bpm with unknown quality yields:

```text
Evidence Navigator / heart_rate: measurement available, 62.0 bpm; status=available; acquisition quality=unknown. Unknown acquisition quality does not make this measurement missing.
Evidence Navigator / sleep_duration: no measurement value was supplied; status=missing_data; acquisition quality=not supplied.
No personal baseline was supplied for this assessment; whether one exists elsewhere is unknown.
```

The baseline sentence above applies when no CognitiveGuard result was supplied.
When a supplied result has a null baseline, the summary instead says no comparison
is available **from this assessment**; history may still have been supplied and the
current attempt may be interrupted or stale. A non-null baseline is acknowledged.

The system prompt explicitly separates measurement availability, unknown quality,
suitability for a named inference, and inability to determine the cause of fatigue.
Existing clinical/safety restrictions and numerical authority are preserved.
The model projection uses this scoped summary instead of the inventory's existing
`what_data_show`/`unknowns` prose, which could invite a global missing-evidence claim.
Raw per-item fields, limitations, notices and quality issues remain in the context.

The complete API response, fields, contract, deterministic assessments, and frontend
are unchanged. The summary is internal context, not an additional API field or text
inserted into `answer`. No answer filtering, substring replacements, new medical
rules, thresholds, model settings, transport changes or dependencies are introduced.

## Verification and actual model behavior

- Backend pytest: **271 passed**, including 14 new cases. Existing Starlette/httpx
  deprecation warning only. Tests cover the 62 bpm scenario in both wire modes,
  absent/null measurements, unknown/poor quality, stale values, missing/available
  baselines, interrupted attempts with supplied history, and independent cognitive
  observations. They also verify unchanged deterministic responses and that a
  deliberately incorrect mock answer is not silently rewritten.
- **Mocked LLM responses do not prove generation accuracy.** Tests establish the
  context and transport behavior, not whether Qwen follows the instructions.
- One pre-change real Qwen call already acknowledged the 62 bpm observation; the
  original contradiction was not consistently reproduced in that sample. This is
  not a measured before/after error-rate comparison.
- Two post-change calls to actual local `qwen3:4b-instruct` returned HTTP 200,
  without truncation: 1.86 seconds through the FastAPI test client and 1.73 seconds
  through Uvicorn/HTTP using the reproducible scenario below. Both acknowledged
  62 bpm as available with unknown quality, named sleep/cognitive values as missing,
  and used the scoped baseline wording. Neither targeted contradiction occurred.
- A separate overclaim **still occurred** in the HTTP smoke answer: "The app's
  optional checks (sleep, reaction time) were not performed." Their results were
  not supplied; execution history is unknown. The prompt already prohibits this,
  but it is not a guarantee. The response is left intact rather than censored.
  The deterministic data and visible limitations remain authoritative. These small
  smoke samples do not prove general reliability, medical validity, or future absence
  of either targeted contradiction.
- Frontend checks were not rerun: this change is limited to backend context/prompt,
  regression tests, the smoke scenario and this note; no API or frontend files changed.

With a backend running from this branch, repeat the synthetic scenario:

```bat
python backend\scripts\smoke_assistant.py --base-url http://127.0.0.1:8000 --scenario heart-rate-62
```

The script checks transport and deterministic fields, prints the unmodified answer,
and asks for manual prose review. Its default `missing` scenario is preserved.
