/**
 * SYNTHETIC MISSION SIMULATION — request/response core.
 *
 * Pure message handling with no Web Worker API, so it runs and is tested in the normal test
 * environment. The actual Web Worker wrapper is phase 2. The mission lives in the closure: "init"
 * computes it once, the other requests only read it.
 */
import { CREW_IDS, DOMAIN_IDS } from './types';
import type { Mission, WorkerRequest, WorkerResponse } from './types';
import { runMission } from './mission';
import { missionMeta, seriesView, snapshotAt } from './snapshot';

export interface WorkerCore {
  handle: (req: WorkerRequest) => WorkerResponse;
}

const error = (message: string): WorkerResponse => ({ type: 'error', message });

export function createWorkerCore(now: () => number): WorkerCore {
  let mission: Mission | null = null;

  const handle = (req: WorkerRequest): WorkerResponse => {
    try {
      if (req.type === 'init') {
        const start = now();
        mission = runMission(req.seed);
        return { type: 'ready', meta: missionMeta(mission, now() - start) };
      }
      if (mission === null) return error('The mission is not initialised: send init first.');
      if (req.type === 'snapshot') {
        return { type: 'snapshot', snapshot: snapshotAt(mission, req.day) };
      }
      if (!CREW_IDS.includes(req.crew) || !DOMAIN_IDS.includes(req.domain)) {
        return error('Unknown crew member or domain.');
      }
      return { type: 'series', series: seriesView(mission, req.crew, req.domain) };
    } catch (e) {
      return error(e instanceof Error ? e.message : 'Unknown error.');
    }
  };
  return { handle };
}
