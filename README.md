# astronaut-health-monitor
# SpaceKitty

**Evidence first. Explanation second.**

**SpaceKitty** is an experimental, evidence-driven astronaut health monitoring and decision-support prototype created for **NASA Space Apps Challenge 2026**.

Long-duration missions create a difficult question: *what should a crew member do when an observation looks unusual, but the available evidence is incomplete?* SpaceKitty brings together simulated mission telemetry, transparent statistical analysis, optional cognitive checks, and a locally running AI companion. It helps users see **what was measured, what is missing, how reliable the evidence is, and what the system cannot conclude**.

> **Research/demo prototype — not a medical device.** SpaceKitty does not diagnose conditions, determine fitness for duty, or replace qualified crew medical personnel. Mission telemetry in the current demonstration is synthetic, not live astronaut or ISS data.

## What makes SpaceKitty different?

**AI that knows what it doesn't know.** Instead of allowing a language model to invent explanations from incomplete data, SpaceKitty computes a deterministic evidence assessment on the backend and displays it separately from the AI-generated explanation.

For example, in the demonstration, a crew member reports fatigue:

| Evidence | Demonstration result | Interpretation |
| --- | --- | --- |
| Heart rate | 62 bpm | Available; acquisition quality unknown |
| Sleep over the previous 24 hours | Not supplied | Missing evidence |
| Reaction-time check | Not supplied | Missing evidence |
| Personal baseline | Not supplied for this assessment | Cannot compare against a personal reference |

SpaceKitty does **not** conclude that the heart rate explains fatigue. The local AI companion explains the known facts and uncertainties while the authoritative backend assessment remains visible.

## Implemented features

| Module | What it does |
| --- | --- |
| **Vital Monitoring** | Analyzes a series of synthetic physiological readings against available personal history and displays findings and limitations. |
| **Mission Simulation** | Replays a **500-day synthetic mission** involving **four crew members**, multiple health domains, trends, events, and follow-up states. |
| **Evidence Navigator** | Distinguishes available, missing, stale, and poor-quality evidence, including its provenance and uncertainty. |
| **CognitiveGuard** | Provides an experimental browser reaction-time check with interruption and quality handling. |
| **Working Memory (1-back)** | Offers an experimental 20-item working-memory task; results stay in browser memory and are **not** part of the medical assessment or AI context. |
| **MindGuard** | Includes voluntary self-reported stress check-ins and gentle guided breathing; no stress diagnosis or claim of treatment effectiveness. |
| **Local AI Companion** | Runs **Qwen3 4B Instruct via Ollama**, with a FastAPI endpoint that recomputes the evidence assessment. AI text is clearly labeled and can be read aloud with browser speech synthesis. |
| **Interface** | SpaceKitty branding, English/Russian interface, light/dark themes, and a five-step demo journey. Some backend-generated text remains in English. |

**Not part of the integrated main application:** an experimental microphone-based acoustic component is being developed separately. It should not be presented as a connected flight/medical sensor.

## Architecture

```text
Synthetic mission telemetry      Optional browser-based checks
             \                         /
              \                       /
               React + TypeScript (Vite)
                         |
                    FastAPI (Python)
                         |
            +------------+-------------+
            |                          |
  Deterministic analysis      Evidence validation
  Median / MAD               Availability, age,
  EWMA / CUSUM               quality, provenance
            |                          |
            +------------+-------------+
                         |
             Recomputed assessment
                         |
                  Ollama (local)
                Qwen3 4B Instruct
                         |
           Explanation shown alongside
          authoritative assessment data
```

**Design principle:** the language model explains results; it does not overwrite the backend's calculations or establish a medical diagnosis.

### Statistical methods

- **Median and median absolute deviation (MAD):** robust summaries of an individual's measurement history.
- **EWMA:** tracks smoothed changes over time.
- **CUSUM:** detects accumulated departures from a reference pattern.
- **Evidence validation:** treats missing, old, or poor-quality observations differently from usable observations.

These are engineering approaches demonstrated on synthetic scenarios. Their presence does not establish clinical validity.

## Run locally

**Prerequisites:** Git, a supported Python installation, Node.js with npm, and [Ollama](https://ollama.com/). The AI feature requires enough local memory and compute capacity to run Qwen3 4B.

Clone the repository:

```bash
git clone https://github.com/nyrik1337/astronaut-health-monitor.git
cd astronaut-health-monitor
```

Install the Python dependencies and frontend packages. On **Windows Command Prompt**:

```bat
py -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd frontend
npm ci
cd ..
```

Download the local AI model:

```bash
ollama pull qwen3:4b-instruct
```

Make sure the Ollama application/service is running. You can confirm the model is present with `ollama list`.

Open a terminal in the repository root and launch the API:

```bat
set "ORBITA_OLLAMA_MODEL=qwen3:4b-instruct"
set "ORBITA_OLLAMA_TIMEOUT_SECONDS=120"
set "ORBITA_OLLAMA_NUM_PREDICT=384"
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

> Internal environment-variable names retain the original `ORBITA_` prefix for compatibility after the SpaceKitty rebrand.

In a **second terminal**, start the frontend:

```bat
cd frontend
set "VITE_EXTENSION_API=backend"
set "VITE_ASSISTANT_API=backend"
npm run dev
```

Open **http://localhost:5173**. The backend health endpoint is **http://127.0.0.1:8000/health**, and API documentation is at **http://127.0.0.1:8000/docs**.

The website alone is not enough to operate the AI: **FastAPI and Ollama must also be running on the machine serving the application**. A static frontend deployment does not automatically host the backend or model.

## Suggested demonstration

1. Open **Mission Simulation** and explore the synthetic 500-day crew timeline.
2. Open **Fatigue Evidence** and trigger the synthetic fatigue report.
3. Inspect the evidence inventory: heart rate is available, while sleep and cognitive results are missing.
4. Ask **Local AI Companion**: *“What evidence is available, what is missing, and was a personal baseline supplied?”*
5. Compare the AI-generated explanation with the separately displayed **deterministic backend assessment**.

CognitiveGuard, Working Memory, and MindGuard are additional experimental demonstrations. They should not be represented as clinically validated diagnostic tests.

## Validation and current limitations

The team has run frontend unit tests, backend tests, and manual browser checks, including a live React → FastAPI → Ollama → Qwen round trip. See the repository's test files and development notes for the latest reproducible results. **Software tests are not medical validation.**

Current limitations include:

- The mission's physiological readings are **synthetic**, not live measurements from astronauts or flight-certified sensors.
- There is **no clinical validation**, diagnostic authority, or flight qualification.
- The AI can produce incorrect text; the deterministic assessment and evidence inventory remain authoritative.
- Working Memory and MindGuard are not integrated into the backend's medical evidence pipeline.
- Some backend-generated explanations are English-only even when the interface is set to Russian.
- Local Ollama is needed for live AI answers; a public static website alone cannot provide them.
- Production authentication, secure medical record management, and physical sensor integration are future work.

## Roadmap

1. Add validated adapters for compatible wearable heart-rate, oxygenation, activity, and sleep-monitoring devices.
2. Develop **HabitatGuard** to examine station conditions such as CO₂, temperature, humidity, and acoustic environment alongside crew observations, without asserting causation from correlation.
3. Evaluate algorithms against suitable, properly documented real datasets and expert review.
4. Add secure access controls, auditable data handling, and operationally appropriate medical review workflows.
5. Improve localization, accessibility, reliability testing, and reproducible packaging.

## Source code and documentation

- [`backend/`](backend/) — FastAPI application and tests
- [`frontend/`](frontend/) — React/TypeScript application and tests
- [`docs/`](docs/) — API contract and team coordination documents
- [`backend/ASSISTANT_HANDOFF.md`](backend/ASSISTANT_HANDOFF.md) — AI companion implementation notes

**Developed as a NASA Space Apps Challenge 2026 hackathon prototype.** Not affiliated with or endorsed by NASA. No NASA real-time astronaut telemetry is claimed.
