import { useCallback, useState } from 'react';
import type { AssistantClient } from '../assistant/client';
import type { AssistantContext } from '../assistant/context';
import { AiCompanion } from '../assistantView/AiCompanion';
import { extensionClient, type ExtensionClient } from '../cognitive/client';
import type { Mode } from '../cognitive/types';
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
          Fatigue evidence
        </h2>
        <p className="mission__notice">
          When fatigue is reported, <strong>Evidence Navigator</strong> lists which evidence is available, missing or
          stale. <strong>CognitiveGuard</strong> is an experimental reaction-time check compared only with the same
          person’s earlier checks on the same setup. Neither gives a diagnosis, a risk score or a fitness-for-duty
          decision, and checks are always optional.
        </p>
        <p className="fatigue__source" data-testid="extension-source">
          {client.source === 'mock'
            ? 'Responses: contract-based mock in this browser — the backend routes are not available yet.'
            : 'Responses: ORBITA backend.'}
        </p>
      </div>
      <section className="fatigue-section" aria-labelledby="synthetic-heading">
        <h3 id="synthetic-heading" className="section-heading">
          Synthetic mission reassessment
        </h3>
        <SyntheticPanel client={client} onContextChange={onSyntheticContext} />
      </section>
      <section className="fatigue-section" aria-labelledby="real-heading">
        <h3 id="real-heading" className="section-heading">
          Real participant check
        </h3>
        <RealPanel client={client} userAgent={userAgent} now={now} storage={storage} onContextChange={onRealContext} />
      </section>
      <section className="fatigue-section" aria-labelledby="working-memory-heading">
        <h3 id="working-memory-heading" className="section-heading">
          Working Memory (experimental)
        </h3>
        <WorkingMemoryCheck />
      </section>
      <section className="fatigue-section" aria-labelledby="assistant-heading">
        <h3 id="assistant-heading" className="section-heading">
          AI Companion (experimental)
        </h3>
        <AiCompanion contexts={contexts} client={assistantClient} now={now} />
      </section>
    </div>
  );
}

export default FatigueView;
