import { lazy, Suspense, useMemo, useState } from 'react';
import { type ApiClient, apiClient } from './api/client';
import { AnalysisSummary } from './components/AnalysisSummary';
import { BackendStatus } from './components/BackendStatus';
import { DemoControls } from './components/DemoControls';
import { MetricPanel } from './components/MetricPanel';
import { panelId, tabId, type ViewId, ViewTabs } from './components/ViewTabs';
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

/** The synthetic mission replay is a separate chunk, loaded the first time its view is opened. */
const MissionView = lazy(() => import('./missionView/MissionView'));
/** Evidence Navigator + CognitiveGuard, also loaded only when first opened. */
const FatigueView = lazy(() => import('./fatigueView/FatigueView'));
/** MindGuard stress check-in and relaxed breathing, loaded only when first opened. */
const RecoveryView = lazy(() => import('./recoveryView/RecoveryView'));

const SKIP_LINKS: Record<ViewId, { href: string; label: string }> = {
  dashboard: { href: '#main', label: 'Skip to dashboard' },
  mission: { href: '#mission', label: 'Skip to mission simulation' },
  fatigue: { href: '#fatigue', label: 'Skip to fatigue evidence' },
  recovery: { href: '#recovery', label: 'Skip to stress check-in' },
};

export function App({ client = apiClient }: Props) {
  const [view, setView] = useState<ViewId>('dashboard');
  const [opened, setOpened] = useState<ReadonlySet<ViewId>>(() => new Set(['dashboard']));
  const missionOpened = opened.has('mission');
  const fatigueOpened = opened.has('fatigue');
  const recoveryOpened = opened.has('recovery');
  const selectView = (next: ViewId): void => {
    setView(next);
    setOpened((previous) => (previous.has(next) ? previous : new Set([...previous, next])));
  };
  const demo = useDemoReadings();
  const health = useBackendHealth(client);
  // Memoized so the analysis effect re-runs only when the readings actually change.
  const request = useMemo(() => buildAnalyzeRequest(DEMO_SUBJECT_ID, demo.readings), [demo.readings]);
  const analysis = useAnalysis(client, request);

  const current = demo.readings.at(-1) ?? null;
  const result = analysisForReading(analysis.state, current);

  return (
    <>
      <a className="skip-link" href={SKIP_LINKS[view].href}>
        {SKIP_LINKS[view].label}
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

      <ViewTabs value={view} onChange={selectView} />

      <div
        role="tabpanel"
        id={panelId('dashboard')}
        aria-labelledby={tabId('dashboard')}
        hidden={view !== 'dashboard'}
      >
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
      </div>

      <div
        role="tabpanel"
        id={panelId('mission')}
        aria-labelledby={tabId('mission')}
        hidden={view !== 'mission'}
      >
        {missionOpened && (
          <main id="mission" className="layout" aria-labelledby="mission-heading">
            <Suspense fallback={<p>Loading the synthetic mission replay…</p>}>
              <MissionView />
            </Suspense>
          </main>
        )}
      </div>

      <div
        role="tabpanel"
        id={panelId('fatigue')}
        aria-labelledby={tabId('fatigue')}
        hidden={view !== 'fatigue'}
      >
        {fatigueOpened && (
          <main id="fatigue" className="layout" aria-labelledby="fatigue-heading">
            <Suspense fallback={<p>Loading the fatigue evidence view…</p>}>
              <FatigueView />
            </Suspense>
          </main>
        )}
      </div>

      <div
        role="tabpanel"
        id={panelId('recovery')}
        aria-labelledby={tabId('recovery')}
        hidden={view !== 'recovery'}
      >
        {recoveryOpened && (
          <main id="recovery" className="layout" aria-labelledby="recovery-heading">
            <Suspense fallback={<p>Loading the stress check-in…</p>}>
              <RecoveryView />
            </Suspense>
          </main>
        )}
      </div>

      <footer className="footer">
        {result !== null && <p>{result.disclaimer}</p>}
        <p>{SYNTHETIC_DATA_NOTICE}</p>
      </footer>
    </>
  );
}
