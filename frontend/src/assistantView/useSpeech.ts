import { useCallback, useEffect, useState } from 'react';

/**
 * Optional read-aloud with the browser's built-in speechSynthesis. Speaks only when asked, stops
 * on request and on unmount, and never touches the microphone. Whether a voice runs on-device or
 * through an online service depends on the browser, so no offline guarantee is made.
 */
export interface Speech {
  readonly supported: boolean;
  /** Id of the text currently being read, or null. */
  readonly speakingId: string | null;
  readonly speak: (id: string, text: string) => void;
  readonly stop: () => void;
}

function synth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') return null;
  return window.speechSynthesis;
}

export function useSpeech(): Speech {
  const [supported] = useState(() => synth() !== null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const stop = useCallback(() => {
    synth()?.cancel();
    setSpeakingId(null);
  }, []);

  const speak = useCallback((id: string, text: string) => {
    const engine = synth();
    if (engine === null) return;
    engine.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    // Pick the voice language from the text itself: answers may be English or Russian.
    utterance.lang = /[\u0400-\u04FF]/.test(text) ? 'ru-RU' : 'en-US';
    const done = (): void => setSpeakingId((current) => (current === id ? null : current));
    utterance.onend = done;
    utterance.onerror = done;
    setSpeakingId(id);
    engine.speak(utterance);
  }, []);

  useEffect(() => () => synth()?.cancel(), []);

  return { supported, speakingId, speak, stop };
}
