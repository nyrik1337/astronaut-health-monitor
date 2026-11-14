import type { ChangeEvent } from 'react';
import { SCENARIOS, type ScenarioId } from '../demo/synthetic';
import { formatDateTime } from '../domain/format';
import type { Reading } from '../domain/readings';

type Props = {
  scenario: ScenarioId;
  readings: readonly Reading[];
  onSelectScenario: (scenario: ScenarioId) => void;
  onAddReading: (missing?: readonly string[]) => void;
  onReset: () => void;
};

function isScenarioId(value: string): value is ScenarioId {
  return SCENARIOS.some((item) => item.id === value);
}

export function DemoControls({ scenario, readings, onSelectScenario, onAddReading, onReset }: Props) {
  const definition = SCENARIOS.find((item) => item.id === scenario);
  const newest = readings.at(-1);

  const handleScenarioChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    if (isScenarioId(event.target.value)) {
      onSelectScenario(event.target.value);
    }
  };

  return (
    <section className="demo" aria-labelledby="demo-heading">
      <h2 id="demo-heading" className="section-heading">
        Synthetic demo readings
      </h2>
      <p className="demo__note">
        Generated in this browser for demonstration. Not from a real person or sensor.
      </p>
      <div className="field">
        <label htmlFor="scenario-select">Scenario</label>
        <select id="scenario-select" value={scenario} onChange={handleScenarioChange} aria-describedby="scenario-description">
          {SCENARIOS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <p id="scenario-description" className="muted">
          {definition?.description}
        </p>
      </div>
      <p className="demo__count">
        <span className="numeric">{readings.length}</span> readings
        {newest !== undefined && <> · newest {formatDateTime(newest.timestamp)}</>}
      </p>
      <div className="button-row">
        <button type="button" className="button button--primary" onClick={() => onAddReading()}>
          Add reading
        </button>
        <button type="button" className="button" onClick={() => onAddReading(['spo2_percent'])}>
          Add reading without SpO₂
        </button>
        <button type="button" className="button" onClick={onReset}>
          Reset scenario
        </button>
      </div>
    </section>
  );
}
