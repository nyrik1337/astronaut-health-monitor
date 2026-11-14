import { useMemo } from 'react';
import { type ApiClient, apiClient } from './api/client';
import { AnalysisSummary } from './components/AnalysisSummary';
import { BackendStatus } from './components/BackendStatus';
import { DemoControls } from './components/DemoControls';
import { MetricPanel } from './components/MetricPanel';
import { WarningList } from './components/WarningList';
import { DEMO_SUBJECT_ID } from './demo/synthetic';
import { analysisForReading, metricAnalysisView } from './domain/analysisView';
import { DEMO_METRICS } from './domain/metrics';
import { buildAnalyzeRequest, toSeries } from './domain/readings';
import { useAnalysis } from './hooks/useAnalysis';
import { useBackendHealth } from './hooks/useBackendHealth';
import { useDemoReadings } from './hooks/useDemoReadings';

type Props = {
  client?: ApiClient;
};

const SYNTHETIC_DATA_NOTICE =
  'All readings on this page are synthetic demo data generated in the browser. They are not from a real person or sensor.';

export function App({ client = apiClient }: Props) {
  const demo = useDemoReadings();
  const health = useBackendHealth(client);
  // Memoized so the analysis effect re-runs only when the readings actually change.
  const request = useMemo(() => buildAnalyzeRequest(DEMO_SUBJECT_ID, demo.readings), [demo.readings]);
  const analysis = useAnalysis(client, request);

  const current = demo.readings.at(-1) ?? null;
  const result = analysisForReading(analysis.state, current);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to dashboard
      </a>
      <header className="masthead">
        <div className="masthead__title">
          <h1>Astronaut Health Monitor</h1>
          <p className="masthead__subject">
            Subject <code>{DEMO_SUBJECT_ID}</code>
            <span className="tag">Synthetic demo data</span>
          </p>
        </div>
        <BackendStatus state={health.state} baseUrl={client.baseUrl} onRecheck={health.recheck} />
      </header>

      <main id="main" className="layout">
        <div className="overview">
          <AnalysisSummary
            state={analysis.state}
            analysis={result}
            historyCount={request?.history.length ?? 0}
            onRetry={analysis.retry}
          />
          <DemoControls
            scenario={demo.scenario}
            readings={demo.readings}
            onSelectScenario={demo.selectScenario}
            onAddReading={demo.addReading}
            onReset={demo.reset}
          />
        </div>

        <section aria-labelledby="vitals-heading" className="vitals">
          <h2 id="vitals-heading" className="section-heading">
            Vital signs compared with personal history
          </h2>
          {DEMO_METRICS.map((definition, index) => (
            <MetricPanel
              key={definition.key}
              folio={index + 1}
              definition={definition}
              series={toSeries(demo.readings, definition.key)}
              view={metricAnalysisView(analysis.state, result, definition.key)}
            />
          ))}
        </section>

        <WarningList warnings={result?.warnings ?? null} />
      </main>

      <footer className="footer">
        {result !== null && <p>{result.disclaimer}</p>}
        <p>{SYNTHETIC_DATA_NOTICE}</p>
      </footer>
    </>
  );
}
