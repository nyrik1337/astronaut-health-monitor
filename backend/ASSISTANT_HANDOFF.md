# Local AI Companion handoff

Status: Implemented on `feature/local-ai-companion`; human PR review pending.
Contract-first commit: `ef72e6f8e3487495fc004dca3fb1cde9eb59c9a3` (pushed).
This is the exact contract revision for review, not a claim of human approval.
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
MindGuard's voluntary stress check-in and breathing practice landed on `origin/main`
in `5afdfbf` during this work; that frontend can set the flag when the feature is
accessible. A self-report in the question must remain a self-report, not hormone data.
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
With the server running, a real model smoke test can be repeated in another CMD:

```bat
cd /d "C:\Users\great\OneDrive\Рабочий стол\orbita-local-ai-companion"
"..\astronaut-health-monitor\backend\.venv\Scripts\python.exe" backend\scripts\smoke_assistant.py
```

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

## Verification and remaining review

- Backend: 257 tests passed (200 existing, 57 assistant tests), including mocked
  success/errors, context isolation, missing/stale/poor evidence, history/baseline,
  interrupted attempts, bounds, configurable generation, deadline and concurrent
  readiness/analysis. One existing Starlette/httpx deprecation warning remains.
- Frontend at the original base `eace18c`: typecheck, 192 tests and build passed.
  After MindGuard merged, the unchanged latest frontend at `5afdfbf` was separately
  verified: typecheck, 198 tests and build passed. Existing bundle-size warning remains.
- Actual local HTTP smoke through Uvicorn on 127.0.0.1:8765 and Ollama with
  qwen3:4b-instruct: final missing-measurement fixture returned 200 in 1.57 seconds;
  interrupted synthetic attempt returned 200 in 2.11 seconds, poor_quality and
  insufficient_history issues, null baseline, and no output truncation. An earlier
  first request took 7.76 seconds. These timings are observations, not guarantees.
- Model quality limitation observed in those real calls: Qwen can say a missing
  check was not performed, or conflate insufficient history with the reason for poor
  acquisition quality. Prompts explicitly forbid both, but do not guarantee compliance.
  The deterministic fields correctly preserve unknown/poor quality and null baselines;
  those fields and their limitations must remain visible and authoritative. Do not
  present the model text as a validated assessment. No numerical baseline was invented
  in the tested outputs. This smoke test is not a comprehensive safety evaluation.
- No frontend chat implementation was changed or claimed tested. Claude still needs
  to wire the reviewed contract into chat and verify it in the browser. No dependency
  files changed. The original checkout's unrelated README edit is preserved.
- Contract commit is published for human review, not yet human-approved. No approved
  contract hash can honestly be supplied until that review occurs. The PR must not be
  merged without human approval. The implementation branch was not rebased onto or
  merged with the later frontend-only main update.
