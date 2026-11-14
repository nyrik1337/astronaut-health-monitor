/**
 * SYNTHETIC MISSION SIMULATION — pipeline (experimental, not clinically validated).
 *
 * generate → analyse each series → raw detections → environmental events and groups →
 * personal alerts with follow-up → alert budget → ground-truth labels → per-day grid.
 * A pure function of the seed: the same seed always gives the same mission.
 */
import { CREW_IDS, DOMAIN_IDS, MISSION_DAYS } from './types';
import type { Alert, CrewId, DetectionRecord, DomainId, Mission, SeriesAnalysis } from './types';
import { generateMission } from './generate';
import { analyzeSeries } from './detect';
import { detectEnvironmentalEventDays, findCandidates } from './detections';
import type { Candidate } from './detections';
import { envZScores, findGroups } from './crewVsEnv';
import { buildEnvironmentalAlert, buildGroupAlert, buildPersonalAlerts } from './closedLoop';
import {
  coveringEnvironmentalEvent,
  coveringGroup,
  eventRuns,
  groupCloseDay,
  holdOf,
} from './assemble';
import { applyBudget, DEFAULT_BUDGET } from './budget';
import { buildGrid } from './grid';
import { labelAlert } from './label';

type Analysis = Record<CrewId, Record<DomainId, SeriesAnalysis>>;

const record = (
  c: Candidate,
  disposition: DetectionRecord['disposition'],
  alertId: string | null,
): DetectionRecord => ({
  id: c.id,
  crew: c.crew,
  domain: c.domain,
  kind: c.kind,
  day: c.day,
  direction: c.direction,
  disposition,
  alertId,
  decisionDay: c.day + holdOf(c),
});

export function runMission(seed: number): Mission {
  const generated = generateMission(seed);
  const analysis = {} as Analysis;
  for (const c of CREW_IDS) {
    analysis[c] = {} as Analysis[CrewId];
    for (const d of DOMAIN_IDS) analysis[c][d] = analyzeSeries(generated.values[c][d]);
  }
  const environmentalEventDays = detectEnvironmentalEventDays(analysis);
  const runs = eventRuns(environmentalEventDays);
  const envZ = envZScores(generated.env);
  const candidates = CREW_IDS.flatMap((c) =>
    DOMAIN_IDS.flatMap((d) => findCandidates(c, d, analysis[c][d])),
  );
  const groups = findGroups(
    candidates.filter((c) => c.kind === 'drift'),
    envZ,
  );
  const closeDays = new Map(groups.map((g) => [g.id, groupCloseDay(g, analysis, envZ)]));

  const detections: DetectionRecord[] = [];
  const personal: Candidate[] = [];
  for (const c of candidates) {
    const environment = coveringEnvironmentalEvent(c, runs);
    const group = environment === null ? coveringGroup(c, groups, closeDays) : null;
    if (environment !== null) detections.push(record(c, 'covered_by_environmental_event', environment));
    else if (group !== null) detections.push(record(c, 'grouped', group));
    else personal.push(c);
  }

  const raw: Alert[] = [];
  for (const crew of CREW_IDS) {
    for (const domain of DOMAIN_IDS) {
      const own = personal.filter((c) => c.crew === crew && c.domain === domain);
      const result = buildPersonalAlerts(own, analysis[crew][domain], generated.values[crew][domain]);
      raw.push(...result.alerts);
      for (const a of result.alerts) {
        const c = own.find((x) => x.id === a.id);
        if (c) detections.push(record(c, 'alert', a.id));
      }
      for (const m of result.merged) detections.push(record(m.candidate, 'merged_into_open_alert', m.alertId));
    }
  }
  groups.forEach((g) => raw.push(buildGroupAlert(g, closeDays.get(g.id) ?? null)));
  runs.forEach((r) => raw.push(buildEnvironmentalAlert(r.start, r.end)));

  const alerts = applyBudget(raw, DEFAULT_BUDGET).map((a) => labelAlert(a, generated.events));
  const doseDaily = Array.from(
    { length: MISSION_DAYS },
    (_, i) =>
      CREW_IDS.reduce((s, c) => s + (generated.values[c].radiation[i] ?? 0), 0) / CREW_IDS.length,
  );
  return {
    synthetic: true,
    seed,
    generated,
    analysis,
    grid: buildGrid(analysis, alerts),
    alerts,
    detections: detections.sort((a, b) => a.day - b.day || a.id.localeCompare(b.id)),
    environmentalEventDays,
    doseDaily,
    budgetPerDay: DEFAULT_BUDGET,
  };
}
