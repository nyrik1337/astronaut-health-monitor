import type { AssistantResponse } from '../assistant/types';
import { CognitiveResult } from '../fatigueView/CognitiveResult';
import { EvidenceResult, TextList } from '../fatigueView/EvidenceResult';
import { useT } from '../i18n';


type Props = {
  response: AssistantResponse;
  speaking: boolean;
  speechSupported: boolean;
  onSpeak: () => void;
  onStop: () => void;
};

/** One AI answer, rendered strictly as plain text, with its provenance, limitations and disclaimer. */
export function AssistantAnswer({ response, speaking, speechSupported, onSpeak, onStop }: Props) {
  const { t } = useT();
  return (
    <div className="assistant__answer" data-testid="assistant-answer">
      <p className="assistant__answer-meta">
        <span className="tag">{t('ai.generated')}</span> {t(`ai.prov.${response.provenance}`)} · {t('ai.modelCode')}{' '}
        <code>{response.model}</code>
      </p>
      <p className="assistant__answer-text">{response.answer}</p>
      {response.truncated && (
        <p className="assistant__error">{t('ai.truncated')}</p>
      )}
      <div className="button-row">
        {speechSupported ? (
          speaking ? (
            <button type="button" className="button" onClick={onStop}>
              {t('ai.stop')}
            </button>
          ) : (
            <button type="button" className="button" onClick={onSpeak}>
              {t('ai.speak')}
            </button>
          )
        ) : (
          <p className="muted">{t('ai.noSpeech')}</p>
        )}
      </div>
      <TextList title={t('ai.limitations')} items={response.limitations} />
      <p className="assistant__disclaimer">{response.disclaimer}</p>
      {(response.evidence !== null || response.cognitive !== null) && (
        <details className="assistant__assessments" open data-testid="assistant-assessments">
          <summary>{t('ai.recomputed')}</summary>
          {response.evidence !== null && <EvidenceResult response={response.evidence} />}
          {response.cognitive !== null && <CognitiveResult response={response.cognitive} />}
        </details>
      )}
    </div>
  );
}
