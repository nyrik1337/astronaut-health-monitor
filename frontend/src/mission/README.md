# Mission simulation (synthetic, experimental)

Phase 1 of the SpaceKitty → ORBITA integration: the 500-day mission simulation engine, migrated from
SpaceKitty commit `7135a2e`. Logic only — no UI, no Web Worker wrapper, no backend calls yet.

**Everything here is synthetic.** Four synthetic crew members, six domains, 500 days, all generated
in the browser from a seed. The detection rules (robust z-score, EWMA, CUSUM, signal categories,
grouping, alert budget) are **experimental and not clinically validated**. They describe statistical
deviation from a personal baseline. They do not diagnose, predict or recommend treatment. The
approved API analysis stays with the FastAPI backend (`docs/API_CONTRACT.md`).

## Rules the code enforces

| Rule | Where | Test |
| --- | --- | --- |
| Days 1–30 only build the baseline; nothing is evaluated before day 31 | `detect.ts` | `safety.test.ts` |
| No value from a later day is used to analyse an earlier day | `detect.ts`, `detections.ts`, `crewVsEnv.ts`, `assemble.ts` | `safety.test.ts` |
| Missing values are skipped, never invented; < 5 valid baseline values → no evaluation | `detect.ts`, `guards.ts` | `safety.test.ts` |
| Statistical score is separate from its description | `signals.ts` | `signals.test.ts` |
| Categories: Within baseline, Short-term deviation, Sustained deviation, Multiple signals, Requires human review — not a severity scale | `types.ts`, `signals.ts` | `signals.test.ts`, `inspect.test.ts` |
| Simulated environmental events are a separate kind, not a "highest level" | `types.ts`, `closedLoop.ts` | `scenarios.test.ts` |
| Texts are factual; no treatment, exercise or behaviour instructions; no causal claims | `explain.ts` | `inspect.test.ts` |
| Follow-up outcome is `returned_to_range`, never "helped" | `closedLoop.ts` | `scenarios.test.ts` |
| Nothing is dropped silently: every raw detection has a recorded disposition; the budget defers but never removes | `mission.ts`, `budget.ts` | `inspect.test.ts`, `budget.test.ts` |
| Same seed → same mission and same snapshots | whole pipeline | `safety.test.ts`, `scenarios.test.ts` |

`ILLUSTRATIVE_EVENT_DOSE_REFERENCE_MSV` (250 mSv) is an illustrative simulation parameter for the
display, not a validated action threshold.

## Pipeline

`generate` → `analyzeSeries` per series → `findCandidates` → environmental events (`detections.ts`)
and groups (`crewVsEnv.ts`) → routing (`assemble.ts`) → personal alerts with follow-up checks
(`closedLoop.ts`) → alert budget (`budget.ts`) → ground-truth labels (`label.ts`) → per-day grid
(`grid.ts`). `snapshotAt(mission, day)` returns only what is known on that day.
