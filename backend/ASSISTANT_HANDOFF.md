# Local AI Companion handoff

Status: contract specified for the requested implementation; human PR review pending.
The normative wire contract is `docs/API_CONTRACT.md`, extension `assistant-1`.
Frontend files belong to Claude and are not changed by this work.

## Supplying the displayed context

POST `/api/assistant/chat` with `question`, `subject_id`, `mode`, `clock`, `as_of`,
`evidence`, `cognitive`, and `gentle_breathing_available` (all required).
`evidence` is the raw request used for the displayed `/api/evidence/assess` result,
or null. `cognitive` is the raw request used for the displayed
`/api/cognitive/analyze` result, including its supplied history, or null.
Do not send response objects or relabel a real test as simulated. Reuse current
subject/mode/clock; update all enclosing `as_of` fields to the same current UTC
instant (real) or mission instant (simulation). Preserve observation/session times.
The server recomputes deterministic assessments so stale results cannot become fresh
and client-supplied baselines cannot override the numerical backend.

Clear/supersede pending chat on subject, mode, or mission-clock changes. Display
`answer` as plain text, alongside `mode`, `provenance`, `limitations`, `disclaimer`,
and any notices in the returned assessments. Do not suppress existing device/UI alerts.
`truncated=true` means generation reached its output budget; show that limitation.
Only set `gentle_breathing_available=true` if that optional application feature is
actually available. This does not assert efficacy or authorize a regimen.
No conversation history is retained; each call supplies its own question/context.

## Windows CMD startup

From a checkout containing the implementation:

```bat
cd /d "C:\Users\great\OneDrive\Рабочий стол\orbita-local-ai-companion"
set "ORBITA_OLLAMA_MODEL=qwen3:4b-instruct"
set "ORBITA_OLLAMA_TIMEOUT_SECONDS=120"
set "ORBITA_OLLAMA_NUM_PREDICT=384"
"..\astronaut-health-monitor\backend\.venv\Scripts\python.exe" -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Ollama must be running locally. If its desktop service is not already running, in
a separate CMD window run `ollama serve`. The model is already installed on this
machine; other machines must install it before an offline demonstration.
Open `http://127.0.0.1:8000/docs` and try `/api/assistant/chat` with the simulation
example from the contract. Existing analysis and `/health` work without Ollama.
For another checkout, use that checkout's own environment and path. No new Python
dependency is needed. For a fresh environment follow `backend/README.md`.

The three environment variables above are optional and show their defaults.
Model: 1–128 non-whitespace characters. Timeout: finite 1–300 seconds.
Output budget: integer 64–1024 tokens. Ollama's URL is fixed to
`http://127.0.0.1:11434` (no external AI URL or proxy). Responses have a further
8,000-character answer limit and a 65,536-byte Ollama envelope limit. One generation
runs at a time per backend process; additional calls get a retryable 503.

## Errors

All errors use `{ "error": { "code": "...", "message": "...", "details": [] } }`.
503 `ASSISTANT_UNAVAILABLE`: local service/model unavailable; 503 `ASSISTANT_BUSY`:
generation already running; 504 `ASSISTANT_TIMEOUT`: deadline exceeded;
502 `ASSISTANT_INVALID_RESPONSE`: invalid/oversized Ollama reply;
500 `ASSISTANT_CONFIGURATION_ERROR`: invalid environment configuration.
Validation/transport errors retain existing 400/413/415/422 envelopes.
Do not display these as successful AI answers or silently substitute fabricated text.

The model's prose is unvalidated and can be wrong despite the safety prompt.
Numerical results, provenance and limitations are deterministic and authoritative.
This local demo is not a medical decision system; qualified crew medical personnel
and approved procedures remain the route for serious or urgent symptoms.
