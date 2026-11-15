import { useEffect, useRef, useState, type FormEvent } from 'react';
import { type ApiError, isAbortError, toApiError } from '../api/errors';
import { assistantClient as defaultClient, type AssistantClient } from '../assistant/client';
import { buildAssistantRequest, contextKey, type AssistantContext } from '../assistant/context';
import { assistantErrorText } from '../assistant/errors';
import { useT, type TKey } from '../i18n';
import { MAX_QUESTION_LENGTH, type AssistantResponse } from '../assistant/types';
import type { Mode } from '../cognitive/types';
import { AssistantAnswer } from './AssistantAnswer';
import { useSpeech } from './useSpeech';
import './assistant.css';

export const MODEL_LABEL = 'Qwen3 4B (local)';

/** Example questions are sent in the language currently shown. */
export const EXAMPLE_QUESTION_KEYS: readonly TKey[] = ['ai.example.1', 'ai.example.2', 'ai.example.3'];

export const EXAMPLE_QUESTIONS = [
  'What evidence is missing?',
  'Why is my cognitive test poor quality?',
  "What can we conclude about the astronaut's fatigue?",
] as const;

export const MODE_CONTEXT_LABEL: Record<Mode, string> = {
  simulation: 'Synthetic simulation — not a real person',
  real_assessment: 'Real participant — your own browser checks (not authenticated)',
};

type Message =
  | { readonly id: string; readonly question: string; readonly mode: Mode; readonly subject: string; readonly status: 'pending' }
  | { readonly id: string; readonly question: string; readonly mode: Mode; readonly subject: string; readonly status: 'answered'; readonly response: AssistantResponse }
  | { readonly id: string; readonly question: string; readonly mode: Mode; readonly subject: string; readonly status: 'failed'; readonly error: ApiError | null };

type Props = {
  contexts: Readonly<Record<Mode, AssistantContext | null>>;
  client?: AssistantClient;
  now?: () => number;
  gentleBreathingAvailable?: boolean;
};

let nextId = 0;
const newId = (): string => `msg-${(nextId += 1)}`;

/**
 * AI Companion: questions about the assessment currently shown in the Fatigue evidence view. It
 * sends only the raw requests behind those results (or null when none was run) — no invented
 * values. Conversation history lives in memory for this page only.
 */
export function AiCompanion({ contexts, client = defaultClient, now = () => Date.now(), gentleBreathingAvailable = true }: Props) {
  const { t } = useT();
  const [mode, setMode] = useState<Mode>('simulation');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<readonly Message[]>([]);
  const pending = useRef<{ id: string; controller: AbortController } | null>(null);
  const speech = useSpeech();
  const context = contexts[mode];
  const key = context === null ? `none|${mode}` : contextKey(context);
  const connected = client.status === 'backend';
  const busy = messages.some((m) => m.status === 'pending');

  const update = (id: string, next: Message): void => setMessages((all) => all.map((m) => (m.id === id ? next : m)));

  // A changed subject, mode or clock supersedes the question still waiting for an answer.
  useEffect(() => {
    pending.current?.controller.abort();
    pending.current = null;
  }, [key]);
  useEffect(() => () => pending.current?.controller.abort(), []);

  const ask = async (text: string): Promise<void> => {
    const trimmed = text.trim();
    if (!connected || busy || context === null || trimmed === '' || trimmed.length > MAX_QUESTION_LENGTH) return;
    const id = newId();
    const base = { id, question: trimmed, mode: context.mode, subject: context.subject_id };
    const controller = new AbortController();
    pending.current = { id, controller };
    setMessages((all) => [...all, { ...base, status: 'pending' }]);
    setQuestion('');
    try {
      const response = await client.chat(buildAssistantRequest(context, trimmed, now(), gentleBreathingAvailable), controller.signal);
      if (controller.signal.aborted) throw new DOMException('aborted', 'AbortError');
      update(id, { ...base, status: 'answered', response });
    } catch (error: unknown) {
      const cancelled = controller.signal.aborted || isAbortError(error);
      const apiError = cancelled ? null : toApiError(error);
      update(id, {
        ...base,
        status: 'failed',
        error: apiError,
      });
    } finally {
      if (pending.current?.id === id) pending.current = null;
    }
  };

  const onSubmit = (event: FormEvent): void => {
    event.preventDefault();
    void ask(question);
  };
  const clear = (): void => {
    pending.current?.controller.abort();
    pending.current = null;
    speech.stop();
    setMessages([]);
  };

  const tooLong = question.trim().length > MAX_QUESTION_LENGTH;
  const canSend = connected && !busy && context !== null && question.trim() !== '' && !tooLong;

  return (
    <div className="assistant" data-testid="ai-companion">
      <p className="assistant__meta">
        <span className="tag">{t('ai.experimental')}</span> {t('ai.model')}{' '}
        <strong data-testid="assistant-model">{MODEL_LABEL}</strong>. {t('ai.meta')}
      </p>
      {!connected && (
        <p className="assistant__offline" role="status" data-testid="assistant-not-connected">
          {t('ai.notConnected')}
        </p>
      )}

      <fieldset className="assistant__mode">
        <legend>{t('ai.askAbout')}</legend>
        {(['simulation', 'real_assessment'] as const).map((m) => (
          <label key={m}>
            <input type="radio" name="assistant-mode" value={m} checked={mode === m} onChange={() => setMode(m)} />{' '}
            {t(`ai.mode.${m}`)}
          </label>
        ))}
      </fieldset>
      <p className="muted" data-testid="assistant-context">
        {context === null ? (
          t('ai.context.none')
        ) : (
          <>
            {t('ai.context.subject')} <code>{context.subject_id}</code> · {t('ai.context.evidence')}{' '}
            {context.evidence === null ? t('ai.context.notRun') : t('ai.context.included')} · {t('ai.context.cognitive')}{' '}
            {context.cognitive === null ? t('ai.context.notRun') : t('ai.context.included')}
          </>
        )}
      </p>

      <ol className="assistant__log" aria-label={t('ai.log')} aria-live="polite">
        {messages.map((m) => (
          <li key={m.id} className="assistant__turn" data-status={m.status}>
            <p className="assistant__question">
              <span className="tag">{t(`ai.tag.${m.mode}`)}</span> {t('ai.asked')} <code>{m.subject}</code>:{' '}
              {m.question}
            </p>
            {m.status === 'pending' && <p className="muted">{t('ai.waiting', { model: MODEL_LABEL })}</p>}
            {m.status === 'failed' && (
              <p className="assistant__error" role="alert">
                <strong>{t('ai.noAnswer')}</strong>{' '}
                {m.error === null ? t('ai.cancelled') : assistantErrorText(m.error, t)}
              </p>
            )}
            {m.status === 'answered' && (
              <AssistantAnswer
                response={m.response}
                speaking={speech.speakingId === m.id}
                speechSupported={speech.supported}
                onSpeak={() => speech.speak(m.id, m.response.answer)}
                onStop={speech.stop}
              />
            )}
          </li>
        ))}
      </ol>

      <div className="button-row" role="group" aria-label={t('ai.examples')}>
        {EXAMPLE_QUESTION_KEYS.map((key) => (
          <button key={key} type="button" className="button" disabled={!connected || busy || context === null} onClick={() => void ask(t(key))}>
            {t(key)}
          </button>
        ))}
      </div>
      <form className="assistant__form" onSubmit={onSubmit}>
        <label htmlFor="assistant-question">{t('ai.question')}</label>
        <p className="muted">{t('ai.answerLang')}</p>
        <textarea
          id="assistant-question"
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          aria-invalid={tooLong}
          disabled={!connected}
        />
        {tooLong && <p className="assistant__error">{t('ai.tooLong', { max: MAX_QUESTION_LENGTH })}</p>}
        <div className="button-row">
          <button type="submit" className="button button--primary" disabled={!canSend}>
            {busy ? t('ai.sending') : t('ai.send')}
          </button>
          <button type="button" className="button" onClick={clear} disabled={messages.length === 0}>
            {t('ai.clear')}
          </button>
        </div>
      </form>
    </div>
  );
}
