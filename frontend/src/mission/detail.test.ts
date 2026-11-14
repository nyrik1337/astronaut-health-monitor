// Cell details and detection views: only what is known on the requested day.
import { describe, expect, it } from 'vitest';
import { cellDetail } from './detail';
import { runMission } from './mission';
import { snapshotAt } from './snapshot';
import { BASELINE_DAYS, CREW_IDS, DEMO_SEED, DOMAIN_IDS, MISSION_DAYS } from './types';

const mission = runMission(DEMO_SEED);

describe('cellDetail', () => {
  it('withholds the baseline and the detector state during days 1-30', () => {
    for (const day of [1, 10, BASELINE_DAYS]) {
      const d = cellDetail(mission, 'B', 'sleep', day);
      expect(d.synthetic).toBe(true);
      expect(d.baseline).toBeNull();
      expect(d.baselineDaysCollected).toBe(day);
      expect(d.state).toBe('baseline_building');
      expect([d.z, d.ewma, d.cusumHi, d.cusumLo]).toEqual([null, null, null, null]);
      expect(d.values).toHaveLength(day);
    }
  });

  it('shows values up to the day and that day’s detector state from day 31', () => {
    const d = cellDetail(mission, 'B', 'sleep', 70);
    const a = mission.analysis.B.sleep;
    expect(d.values).toEqual(mission.generated.values.B.sleep.slice(0, 70));
    expect(d.value).toBe(mission.generated.values.B.sleep[69]);
    expect(d.baseline).toEqual(a.baseline);
    expect(d.z).toBe(a.z[69]);
    expect(d.ewma).toBe(a.ewma[69]);
    expect(d.cusumLo).toBe(a.cusumLo[69]);
    expect(d.state).toBe(mission.grid[69]?.[1]?.[3]);
  });

  it('clamps the day and covers every cell', () => {
    expect(cellDetail(mission, 'A', 'cardio', 9999).day).toBe(MISSION_DAYS);
    expect(cellDetail(mission, 'A', 'cardio', -3).day).toBe(1);
    for (const crew of CREW_IDS) {
      for (const domain of DOMAIN_IDS) {
        expect(cellDetail(mission, crew, domain, 200).values).toHaveLength(200);
      }
    }
  });
});

describe('snapshot detections', () => {
  it('shows a drift detection as pending during the grouping hold, then notified', () => {
    const at = (day: number) =>
      snapshotAt(mission, day).detections.find((d) => d.id === 'drift-B-sleep-64');
    expect(at(63)).toBeUndefined();
    expect(at(64)?.status).toBe('pending_grouping_check');
    expect(at(66)?.status).toBe('pending_grouping_check');
    expect(at(67)?.status).toBe('notified');
  });

  it('reveals grouping and coverage only from the decision day on', () => {
    const grouped = snapshotAt(mission, 125).detections.filter((d) => d.status === 'grouped');
    expect(grouped).toHaveLength(0);
    const later = snapshotAt(mission, 127).detections.filter((d) => d.status === 'grouped');
    expect(later.map((d) => d.crew).sort()).toEqual(['A', 'C', 'D']);
    const covered = snapshotAt(mission, 300).detections.filter(
      (d) => d.status === 'covered_by_environmental_event',
    );
    expect(covered).toHaveLength(4);
  });

  it('never reveals a routing before its decision day', () => {
    for (let day = 1; day <= MISSION_DAYS; day += 7) {
      for (const d of snapshotAt(mission, day).detections) {
        expect(d.day).toBeLessThanOrEqual(day);
        if (day < d.decisionDay) expect(d.status).toBe('pending_grouping_check');
        if (d.status === 'notified') {
          expect(mission.alerts.find((a) => a.id === d.alertId)?.day).toBeLessThanOrEqual(day);
        }
      }
    }
  });
});
