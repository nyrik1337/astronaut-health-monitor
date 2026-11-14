# Backend MVP

Stateless FastAPI/Pydantic/Pandas implementation of [the approved contract](../docs/API_CONTRACT.md).
Requires Python 3.11 or newer. Run these PowerShell commands from the repository root:

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
backend/.venv/Scripts/python.exe -m pytest backend/tests -q
backend/.venv/Scripts/python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

For runtime-only installation, use `backend/requirements.txt` instead.
The API is available at `http://127.0.0.1:8000`, with `GET /health` and
`POST /api/analyze`. CORS permits `http://localhost:5173`.
Swagger UI is available at `http://127.0.0.1:8000/docs`, with its OpenAPI
schema at `http://127.0.0.1:8000/openapi.json`.

React owns the history and displays returned medians as baseline lines.
Five samples is only a demonstration rule, not evidence of clinical reliability.
No database, model service, or external credentials are required.

Approved numeric clarification: the contract example lists a robust Z-score of
`2.697`, but its formula gives `round(4 / 1.4826, 3) = 2.698`. The implementation
and tests use the approved formula result, `2.698`; the contract file is unchanged.
