# ORBITA Agent Instructions

## Project and architecture

ORBITA is an astronaut health-monitoring MVP. The React/TypeScript/Vite frontend owns synthetic demo readings and sends the current reading plus history to a stateless FastAPI/Python analytics backend. The backend returns descriptive median/MAD analysis; it does not persist readings.

## Ownership and boundaries

- OpenAI Codex on Windows owns `backend/`, including FastAPI, Python analytics, schemas, and API design.
- Claude Code Desktop on macOS owns `frontend/`, including React, TypeScript, Vite, and frontend tests.
- Coordinate before editing shared files such as root configuration or `docs/`.
- `docs/API_CONTRACT.md` is the single approved API contract. Do not invent endpoints, fields, statuses, or behaviors, and do not change the API without human approval.
- Label synthetic data clearly as synthetic everywhere it is generated, transmitted, or displayed.
- Do not present unvalidated medical diagnoses or autonomous treatment advice. Preserve the existing MVP functionality and safety framing.

## Verification

- Backend changes: run `backend/.venv/Scripts/python.exe -m pytest backend/tests -q` on Windows, or the equivalent environment-specific `python -m pytest backend/tests -q`.
- Frontend changes: from `frontend/`, run `npm run typecheck`, `npm test`, and `npm run build`.
- Contract or cross-stack changes: run both backend and frontend checks and verify representative request/response JSON against `docs/API_CONTRACT.md`.
- Keep changes scoped; do not modify dependencies, generated files, or unrelated code without explicit approval.

## Git workflow

- Start from the latest `origin/main` and work on a dedicated feature or chore branch.
- Share work through GitHub Pull Requests; never force-push or commit directly to `main`.
- Do not push, merge, or alter another agent's branch without explicit authorization.
- A human developer must review and approve every merge.
