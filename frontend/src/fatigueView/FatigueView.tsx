import { useCallback, useState } from 'react';
import type { AssistantClient } from '../assistant/client';
import type { AssistantContext } from '../assistant/context';
import { AiCompanion } from '../assistantView/AiCompanion';
import { extensionClient, type ExtensionClient } from '../cognitive/client';
import type { Mode } from '../cognitive/types';
import { Rich, useT } from '../i18n';
import { RealPanel } from './RealPanel';
import { WorkingMemoryCheck } from '../workingMemory/WorkingMemoryCheck';
import { SyntheticPanel } from './SyntheticPanel';
import './fatigue.css';

type Props = {
  client?: ExtensionClient;
  userAgent?: string;
  now?: () => number;
  storage?: Storage | null;
  assistantClient?: AssistantClient;
};

/**
 * Evidence Navigator + CognitiveGuard (contract extension `evidence-cognitive-1`). Two separate
 * contexts with their own subject, clock and history: a synthetic mission demonstration and a
 * real participant's browser check. Neither gives a diagnosis or a fitness-for-duty decision.
 */
export function FatigueView({ client = extensionClient, userAgent, now, storage, assistantClient }: Props) {
  const { t } = useT();
  const [contexts, setContexts] = useState<Readonly<Record<Mode, AssistantContext | null>>>({
    simulation: null,
    real_assessment: null,
  });
  const onSyntheticContext = useCallback((c: AssistantContext) => setContexts((all) => ({ ...all, simulation: c })), []);
  const onRealContext = useCallback((c: AssistantContext) => setContexts((all) => ({ ...all, real_assessment: c })), []);
  return (
    <div className="fatigue">
      <div className="mission__intro">
        <h2 id="fatigue-heading" className="mission__title">
          {t('fatigue.title')}
        </h2>
        <p className="mission__notice">
          <Rich text={t('fatigue.intro')} />
        </p>
        <p className="fatigue__source" data-testid="extension-source">
          {client.source === 'mock' ? t('fatigue.source.mock') : t('fatigue.source.backend')}
        </p>
        <section className="evidence-guide" aria-labelledby="evidence-guide-heading">
          <h3 id="evidence-guide-heading" className="fatigue-list__title">
            {t('guide.title')}
          </h3>
          <ul>
            {(['guide.available', 'guide.missing', 'guide.stale', 'guide.poor'] as const).map((key) => (
              <li key={key}>
                <Rich text={t(key)} />
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="fatigue-section" aria-labelledby="synthetic-heading">
        <h3 id="synthetic-heading" className="section-heading">
          {t('fatigue.h.synthetic')}
        </h3>
        <SyntheticPanel client={client} onContextChange={onSyntheticContext} />
      </section>
      <section className="fatigue-section" aria-labelledby="real-heading">
        <h3 id="real-heading" className="section-heading">
          {t('fatigue.h.real')}
        </h3>
        <RealPanel client={client} userAgent={userAgent} now={now} storage={storage} onContextChange={onRealContext} />
      </section>
      <section className="fatigue-section" aria-labelledby="working-memory-heading">
        <h3 id="working-memory-heading" className="section-heading">
          {t('fatigue.h.wm')}
        </h3>
        <WorkingMemoryCheck />
      </section>
      <section className="fatigue-section" aria-labelledby="assistant-heading">
        <h3 id="assistant-heading" className="section-heading">
          {t('fatigue.h.ai')}
        </h3>
        <AiCompanion contexts={contexts} client={assistantClient} now={now} />
      </section>
    </div>
  );
}

export default FatigueView;
