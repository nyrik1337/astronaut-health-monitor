import { useCallback, useState } from 'react';
import { generateScenario, nextSyntheticReading, type ScenarioId } from '../demo/synthetic';
import { appendReading, type Reading } from '../domain/readings';

export interface UseDemoReadingsResult {
  readonly scenario: ScenarioId;
  readonly readings: readonly Reading[];
  readonly selectScenario: (scenario: ScenarioId) => void;
  readonly addReading: (missing?: readonly string[]) => void;
  readonly reset: () => void;
}

/** Owns the locally retained synthetic time series (the backend keeps no measurements). */
export function useDemoReadings(initialScenario: ScenarioId = 'steady'): UseDemoReadingsResult {
  const [scenario, setScenario] = useState<ScenarioId>(initialScenario);
  const [readings, setReadings] = useState<readonly Reading[]>(() =>
    generateScenario(initialScenario, new Date()),
  );

  const selectScenario = useCallback((next: ScenarioId) => {
    setScenario(next);
    setReadings(generateScenario(next, new Date()));
  }, []);

  const addReading = useCallback((missing: readonly string[] = []) => {
    setReadings((previous) => appendReading(previous, nextSyntheticReading(previous, new Date(), { missing })));
  }, []);

  const reset = useCallback(() => {
    setReadings(generateScenario(scenario, new Date()));
  }, [scenario]);

  return { scenario, readings, selectScenario, addReading, reset };
}
