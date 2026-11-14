// Transparency and wording: nothing is dropped silently, every category is reachable, texts are
// factual and non-diagnostic, synthetic data is labelled, no non-null assertions in the source.
import { describe, expect, it } from 'vitest';
import { analyzeSeries } from './detect';
import { findCandidates } from './detections';
import { GROUPING_HOLD_DAYS } from './closedLoop';
import { SIMULATION_NOTICE } from './explain';
import { runMission } from './mission';
import { seriesView, snapshotAt } from './snapshot';
import {
  CREW_IDS,
  DEMO_SEED,
  DOMAIN_IDS,
  ILLUSTRATIVE_EVENT_DOSE_REFERENCE_MSV,
  MISSION_DAYS,
  SIGNAL_CATEGORIES,
} from './types';
import type { Mission } from './types';

const mission = runMission(DEMO_SEED);

describe('every detection stays inspectable', () => {
  it('each raw detection has exactly one record pointing to an existing alert', () => {
    const raw = CREW_IDS.flatMap((crew) =>
      DOMAIN_IDS.flatMap((domain) =>
        findCandidates(crew, domain, analyzeSeries(mission.generated.values[crew][domain])),
      ),
    );
    const ids = mission.detections.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(raw.map((c) => c.id).sort());
    const alertIds = new Set(mission.alerts.map((a) => a.id));
    for (const d of mission.detections) {
      expect(d.alertId === null || alertIds.has(d.alertId)).toBe(true);
      if (d.disposition === 'alert') expect(d.alertId).toBe(d.id);
      if (d.disposition === 'grouped') expect(d.alertId?.startsWith('group-')).toBe(true);
      if (d.disposition === 'covered_by_environmental_event') {
        expect(d.alertId?.startsWith('environment-')).toBe(true);
      }
    }
    const used = new Set(mission.detections.map((d) => d.disposition));
    expect(used.has('grouped')).toBe(true);
    expect(used.has('covered_by_environmental_event')).toBe(true);
  });

  it('the budget defers but never removes, and drift alerts respect the grouping hold', () => {
    for (const a of mission.alerts) {
      expect(a.day).toBeGreaterThanOrEqual(a.detectedDay);
      if (a.kind === 'drift') expect(a.day).toBeGreaterThanOrEqual(a.detectedDay + GROUPING_HOLD_DAYS);
    }
    const last = snapshotAt(mission, MISSION_DAYS);
    const late = mission.alerts.filter((a) => a.day > MISSION_DAYS);
    expect(last.queue.map((a) => a.id).sort()).toEqual(late.map((a) => a.id).sort());
  });
});

describe('signal categories on the demonstration mission', () => {
  it('reaches all five categories and never puts an environmental event in the grid', () => {
    const states = new Set(mission.grid.flat(2));
    for (const category of SIGNAL_CATEGORIES) expect(states.has(category)).toBe(true);
    expect(states.has('baseline_building')).toBe(true);
    expect(states.has('environmental_event' as never)).toBe(false);
  });
});

/** All texts a viewer can see: titles, texts, follow-ups including review flags. */
function allTexts(m: Mission): string[] {
  const texts: string[] = [];
  for (let day = 1; day <= MISSION_DAYS; day += 1) {
    for (const a of snapshotAt(m, day).alerts) {
      texts.push(a.title, a.text);
      if (a.followUpText) texts.push(a.followUpText);
    }
  }
  return [...new Set(texts)];
}

const FORBIDDEN =
  /\b(should|must|recommend\w*|advi[cs]e\w*|treat\w*|medicat\w*|exercise|training|bedtime|shelter|helped|probably|likely|caused by|because of|go to|move to|reduce|increase)\b/i;

describe('wording', () => {
  it('has no instructions, treatment advice, causal or diagnostic claims (several seeds)', () => {
    for (const seed of [DEMO_SEED, 1, 7]) {
      for (const text of allTexts(runMission(seed))) {
        const withoutNotice = text.replace(SIMULATION_NOTICE, '');
        expect(withoutNotice).not.toMatch(FORBIDDEN);
        expect(withoutNotice).not.toMatch(/diagnos/i);
      }
    }
  });

  it('labels every alert as synthetic and experimental', () => {
    for (const a of mission.alerts) {
      expect(a.synthetic).toBe(true);
      expect(a.text).toContain(SIMULATION_NOTICE);
      expect(a.text.toLowerCase()).toContain('synthetic');
    }
    const event = mission.alerts.find((a) => a.kind === 'environmental_event');
    expect(event?.text).toContain(`${ILLUSTRATIVE_EVENT_DOSE_REFERENCE_MSV} mSv`);
    expect(event?.text).toContain('not a validated action threshold');
  });

  it('marks mission, snapshot and series as synthetic', () => {
    expect(mission.synthetic).toBe(true);
    expect(mission.generated.synthetic).toBe(true);
    expect(snapshotAt(mission, 200).synthetic).toBe(true);
    expect(seriesView(mission, 'A', 'cardio').synthetic).toBe(true);
  });
});

describe('source hygiene', () => {
  it('uses guards instead of non-null assertions', () => {
    const modules = import.meta.glob<string>(['./*.ts', '!./*.test.ts'], {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    const files = Object.entries(modules);
    expect(files.length).toBeGreaterThan(10);
    for (const [file, code] of files) {
      expect({ file, hits: code.match(/[\w\])]![.[),;\s]/g) ?? [] }).toEqual({ file, hits: [] });
    }
  });
});
