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

interface DemoState {
  readonly scenario: ScenarioId;
  readonly initialReadings: readonly Reading[];
  readonly readings: readonly Reading[];
}

function createDemoState(scenario: ScenarioId): DemoState {
  const initialReadings = generateScenario(scenario, new Date());
  return { scenario, initialReadings, readings: initialReadings };
}

/** Owns the locally retained synthetic time series (the backend keeps no measurements). */
export function useDemoReadings(initialScenario: ScenarioId = 'steady'): UseDemoReadingsResult {
  const [state, setState] = useState<DemoState>(() => createDemoState(initialScenario));

  const selectScenario = useCallback((next: ScenarioId) => {
    setState(createDemoState(next));
  }, []);

  const addReading = useCallback((missing: readonly string[] = []) => {
    setState((previous) => ({
      ...previous,
      readings: appendReading(
        previous.readings,
        nextSyntheticReading(previous.readings, new Date(), { missing }),
      ),
    }));
  }, []);

  const reset = useCallback(() => {
    setState((previous) => ({ ...previous, readings: [...previous.initialReadings] }));
  }, []);

  return {
    scenario: state.scenario,
    readings: state.readings,
    selectScenario,
    addReading,
    reset,
  };
}
