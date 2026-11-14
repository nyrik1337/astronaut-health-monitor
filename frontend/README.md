# Astronaut Health Monitor — frontend

React + TypeScript + Vite + Recharts dashboard for the MVP API in [`../docs/API_CONTRACT.md`](../docs/API_CONTRACT.md).

All readings are **synthetic demo data** generated in the browser (`src/demo/synthetic.ts`). The dashboard
shows how each current value differs from the median of its submitted history; it does not apply clinical
thresholds, diagnoses or severity classes.

## Run

```bash
npm install
npm run dev          # http://localhost:5173 (the origin the backend's CORS policy allows)
```

The backend URL comes from `VITE_API_BASE_URL` (default `http://localhost:8000`). Copy `.env.example` to
`.env` to change it, or pass it inline: `VITE_API_BASE_URL=http://localhost:9000 npm run dev`.

## Check

```bash
npm run typecheck     # tsc for app and Vite config
npm test              # Vitest + Testing Library
npm run test:coverage
npm run build         # typecheck + production bundle in dist/
```

## Layout

```
src/
  api/          typed client for GET /health and POST /api/analyze, zod schemas, ApiError
  domain/       readings → request mapping, formatting, status labels, chart helpers
  demo/         synthetic reading generator and scenarios
  hooks/        useDemoReadings, useBackendHealth, useAnalysis
  components/   presentational UI
  App.tsx       container wiring hooks to components
```

The backend is stateless, so the frontend keeps the raw readings, sends the newest one as `measurements`
and up to 1,000 earlier ones as `history`, and draws the returned `baseline.median` as the chart's
personal-baseline line.
