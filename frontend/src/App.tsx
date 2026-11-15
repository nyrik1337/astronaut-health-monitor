import { lazy, Suspense, useMemo, useState } from 'react';
import { type ApiClient, apiClient } from './api/client';
import { AnalysisSummary } from './components/AnalysisSummary';
import { BackendStatus } from './components/BackendStatus';
import { DemoControls } from './components/DemoControls';
import { MetricPanel } from './components/MetricPanel';
import { panelId, tabId, type ViewId, ViewTabs } from './components/ViewTabs';
import { WarningList } from './components/WarningList';
import { DemoJourney } from './components/DemoJourney';
import { LanguageProvider, LanguageSwitch, useT, type TKey } from './i18n';
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


/** The synthetic mission replay is a separate chunk, loaded the first time its view is opened. */
const MissionView = lazy(() => import('./missionView/MissionView'));
/** Evidence Navigator + CognitiveGuard, also loaded only when first opened. */
const FatigueView = lazy(() => import('./fatigueView/FatigueView'));
/** MindGuard stress check-in and relaxed breathing, loaded only when first opened. */
const RecoveryView = lazy(() => import('./recoveryView/RecoveryView'));

const SKIP_LINKS: Record<ViewId, { href: string; label: TKey }> = {
  dashboard: { href: '#main', label: 'shell.skip.dashboard' },
  mission: { href: '#mission', label: 'shell.skip.mission' },
  fatigue: { href: '#fatigue', label: 'shell.skip.fatigue' },
  recovery: { href: '#recovery', label: 'shell.skip.recovery' },
};

/** The language lives above all views, so switching it never remounts or resets them. */
export function App(props: Props) {
  return (
    <LanguageProvider>
      <AppShell {...props} />
    </LanguageProvider>
  );
}

function AppShell({ client = apiClient }: Props) {
  const { t } = useT();
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
        {t(SKIP_LINKS[view].label)}
      </a>
      <header className="masthead">
        <div className="masthead__title">
          <p className="masthead__brand">{t('shell.brand')}</p>
          <h1>{t('shell.title')}</h1>
          <p className="masthead__subject">
            {t('shell.subject')} <code>{DEMO_SUBJECT_ID}</code>
            <span className="tag">{t('shell.syntheticTag')}</span>
          </p>
        </div>
        <div className="masthead__tools">
          <LanguageSwitch />
          <BackendStatus state={health.state} baseUrl={client.baseUrl} onRecheck={health.recheck} />
        </div>
      </header>

      <ViewTabs value={view} onChange={selectView} />
      <DemoJourney onGo={selectView} />

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
            {t('db.vitals')}
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
            <Suspense fallback={<p>{t('shell.loading.mission')}</p>}>
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
            <Suspense fallback={<p>{t('shell.loading.fatigue')}</p>}>
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
            <Suspense fallback={<p>{t('shell.loading.recovery')}</p>}>
              <RecoveryView />
            </Suspense>
          </main>
        )}
      </div>

      <footer className="footer">
        {result !== null && <p>{result.disclaimer}</p>}
        <p>{t('shell.syntheticNotice')}</p>
        <p>{t('shell.backendText')}</p>
      </footer>
    </>
  );
}
