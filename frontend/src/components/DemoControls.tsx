import type { ChangeEvent } from 'react';
import { SCENARIOS, type ScenarioId } from '../demo/synthetic';
import { formatDateTime } from '../domain/format';
import type { Reading } from '../domain/readings';
import { useT } from '../i18n';

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
  const { t } = useT();
  const newest = readings.at(-1);

  const handleScenarioChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    if (isScenarioId(event.target.value)) {
      onSelectScenario(event.target.value);
    }
  };

  return (
    <section className="demo" aria-labelledby="demo-heading">
      <h2 id="demo-heading" className="section-heading">
        {t('demo.title')}
      </h2>
      <p className="demo__note">
        {t('demo.note')}
      </p>
      <div className="field">
        <label htmlFor="scenario-select">{t('demo.scenario')}</label>
        <select id="scenario-select" value={scenario} onChange={handleScenarioChange} aria-describedby="scenario-description">
          {SCENARIOS.map((item) => (
            <option key={item.id} value={item.id}>
              {t(`demo.${item.id}.label`)}
            </option>
          ))}
        </select>
        <p id="scenario-description" className="muted">
          {t(`demo.${scenario}.description`)}
        </p>
      </div>
      <p className="demo__count">
        <span className="numeric">{readings.length}</span> {t('demo.count')}
        {newest !== undefined && <> · {t('demo.newest', { time: formatDateTime(newest.timestamp) })}</>}
      </p>
      <div className="button-row">
        <button type="button" className="button button--primary" onClick={() => onAddReading()}>
          {t('demo.add')}
        </button>
        <button type="button" className="button" onClick={() => onAddReading(['spo2_percent'])}>
          {t('demo.addNoSpo2')}
        </button>
        <button type="button" className="button" onClick={onReset}>
          {t('demo.reset')}
        </button>
      </div>
    </section>
  );
}
