import type { AssistantResponse } from '../assistant/types';
import { CognitiveResult } from '../fatigueView/CognitiveResult';
import { EvidenceResult, TextList } from '../fatigueView/EvidenceResult';

const PROVENANCE_LABEL: Record<AssistantResponse['provenance'], string> = {
  synthetic_demonstration: 'Synthetic demonstration',
  client_asserted_real: 'Real participant (self-reported, not authenticated or medically validated)',
};

type Props = {
  response: AssistantResponse;
  speaking: boolean;
  speechSupported: boolean;
  onSpeak: () => void;
  onStop: () => void;
};

/** One AI answer, rendered strictly as plain text, with its provenance, limitations and disclaimer. */
export function AssistantAnswer({ response, speaking, speechSupported, onSpeak, onStop }: Props) {
  return (
    <div className="assistant__answer" data-testid="assistant-answer">
      <p className="assistant__answer-meta">
        <span className="tag">AI-generated</span> {PROVENANCE_LABEL[response.provenance]} · model{' '}
        <code>{response.model}</code>
      </p>
      <p className="assistant__answer-text">{response.answer}</p>
      {response.truncated && (
        <p className="assistant__error">This answer reached the local model’s output limit and may be cut off.</p>
      )}
      <div className="button-row">
        {speechSupported ? (
          speaking ? (
            <button type="button" className="button" onClick={onStop}>
              Stop reading
            </button>
          ) : (
            <button type="button" className="button" onClick={onSpeak}>
              Speak answer
            </button>
          )
        ) : (
          <p className="muted">Read-aloud is not available in this browser.</p>
        )}
      </div>
      <TextList title="Limitations" items={response.limitations} />
      <p className="assistant__disclaimer">{response.disclaimer}</p>
      {(response.evidence !== null || response.cognitive !== null) && (
        <details className="assistant__assessments" open data-testid="assistant-assessments">
          <summary>Assessment recomputed by the backend for this answer (deterministic, authoritative)</summary>
          {response.evidence !== null && <EvidenceResult response={response.evidence} />}
          {response.cognitive !== null && <CognitiveResult response={response.cognitive} />}
        </details>
      )}
    </div>
  );
}
