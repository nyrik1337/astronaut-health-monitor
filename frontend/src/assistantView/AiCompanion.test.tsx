import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ApiError } from '../api/errors';
import { notConnectedAssistantClient, type AssistantClient } from '../assistant/client';
import type { AssistantContext } from '../assistant/context';
import type { AssistantRequest, AssistantResponse } from '../assistant/types';
import { createMockExtensionClient } from '../cognitive/client';
import { MISSION_CLOCK, syntheticEvidenceRequest, syntheticSubjectId } from '../cognitive/syntheticStore';
import { UTC_CLOCK, type Mode } from '../cognitive/types';
import { FatigueView } from '../fatigueView/FatigueView';
import { AiCompanion } from './AiCompanion';

// TEST-ONLY fake transport. The production build never fabricates AI answers.
function fakeAssistant(reply: (r: AssistantRequest) => Promise<AssistantResponse>) {
  const requests: AssistantRequest[] = [];
  const client: AssistantClient = {
    status: 'backend',
    chat: (request) => {
      requests.push(request);
      return reply(request);
    },
  };
  return { client, requests };
}

const answer = (r: AssistantRequest, text = 'TEST ANSWER: no measurements were supplied.'): AssistantResponse => ({
  subject_id: r.subject_id,
  mode: r.mode,
  clock: r.clock,
  as_of: r.as_of,
  answer: text,
  model: 'qwen3:4b-instruct',
  generation: 'local_ollama',
  provenance: r.mode === 'simulation' ? 'synthetic_demonstration' : 'client_asserted_real',
  evidence: null,
  cognitive: null,
  limitations: ['AI-generated explanations are unvalidated.'],
  disclaimer: 'Not a medical diagnosis or fitness-for-duty assessment.',
  truncated: false,
});

const SIM: AssistantContext = {
  subject_id: 'sim-crew-B',
  mode: 'simulation',
  clock: MISSION_CLOCK,
  as_of: '2026-03-11T12:00:00Z',
  evidence: null,
  cognitive: null,
};
const REAL: AssistantContext = {
  subject_id: 'participant-01',
  mode: 'real_assessment',
  clock: UTC_CLOCK,
  as_of: '1970-01-01T00:00:00.000Z',
  evidence: null,
  cognitive: null,
};
const contexts = (): Record<Mode, AssistantContext | null> => ({ simulation: SIM, real_assessment: REAL });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AI Companion chat', () => {
  test('sends a question, shows loading, then a plain-text answer with model, provenance and disclaimer', async () => {
    let release: () => void = () => {};
    const fake = fakeAssistant(
      (r) => new Promise((resolve) => (release = () => resolve(answer(r, '<b>not html</b> answer')))),
    );
    render(<AiCompanion contexts={contexts()} client={fake.client} />);
    expect(screen.getByTestId('assistant-model')).toHaveTextContent('Qwen3 4B (local)');

    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: '  What evidence is missing?  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(screen.getByRole('button', { name: 'Waiting for answer…' })).toBeDisabled();
    expect(screen.getByText(/Waiting for Qwen3 4B \(local\)/)).toBeInTheDocument();
    expect(fake.requests[0]?.question).toBe('What evidence is missing?');

    await act(async () => release());
    const shown = await screen.findByTestId('assistant-answer');
    expect(within(shown).getByText('<b>not html</b> answer')).toBeInTheDocument();
    expect(shown.querySelector('b')).toBeNull();
    expect(within(shown).getByText(/Synthetic demonstration/)).toBeInTheDocument();
    expect(within(shown).getByText('Not a medical diagnosis or fitness-for-duty assessment.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled(); // input is empty again
  });

  test.each([
    [new ApiError({ kind: 'http', status: 503, code: 'ASSISTANT_UNAVAILABLE', message: 'x' }), /Ollama is running/],
    [new ApiError({ kind: 'http', status: 504, code: 'ASSISTANT_TIMEOUT', message: 'x' }), /took too long/],
    [new ApiError({ kind: 'timeout', status: null, code: 'TIMEOUT', message: 'x' }), /No answer arrived in time/],
    [new ApiError({ kind: 'network', status: null, code: 'NETWORK_ERROR', message: 'x' }), /Could not reach the ORBITA backend/],
  ])('shows an error, never an AI answer, when the request fails (%#)', async (error, message) => {
    const fake = fakeAssistant(() => Promise.reject(error));
    render(<AiCompanion contexts={contexts()} client={fake.client} />);
    fireEvent.click(screen.getByRole('button', { name: 'What evidence is missing?' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No AI answer.');
    expect(alert).toHaveTextContent(message);
    expect(screen.queryByTestId('assistant-answer')).toBeNull();
  });

  test('labels real participant and synthetic simulation contexts distinctly', async () => {
    const fake = fakeAssistant((r) => Promise.resolve(answer(r)));
    render(<AiCompanion contexts={contexts()} client={fake.client} now={() => Date.parse('2026-11-15T06:00:00Z')} />);
    expect(screen.getByRole('radio', { name: /Synthetic simulation — not a real person/ })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: /Real participant — your own browser checks/ }));
    expect(screen.getByTestId('assistant-context')).toHaveTextContent('participant-01');

    fireEvent.click(screen.getByRole('button', { name: 'Why is my cognitive test poor quality?' }));
    const shown = await screen.findByTestId('assistant-answer');
    expect(within(shown).getByText(/Real participant \(self-reported, not authenticated/)).toBeInTheDocument();
    expect(screen.getByText('Real participant', { selector: '.tag' })).toBeInTheDocument();
    expect(fake.requests[0]).toMatchObject({ mode: 'real_assessment', clock: UTC_CLOCK, as_of: '2026-11-15T06:00:00.000Z' });
  });

  test('sends no invented health values: missing assessments stay null', async () => {
    const fake = fakeAssistant((r) => Promise.resolve(answer(r)));
    render(<AiCompanion contexts={contexts()} client={fake.client} />);
    expect(screen.getByTestId('assistant-context')).toHaveTextContent('Evidence Navigator result: not run yet');
    fireEvent.click(screen.getByRole('button', { name: "What can we conclude about the astronaut's fatigue?" }));
    await screen.findByTestId('assistant-answer');
    expect(fake.requests[0]).toEqual({
      subject_id: 'sim-crew-B',
      mode: 'simulation',
      clock: MISSION_CLOCK,
      as_of: '2026-03-11T12:00:00Z',
      question: "What can we conclude about the astronaut's fatigue?",
      evidence: null,
      cognitive: null,
      gentle_breathing_available: true,
    });
  });

  test('shows the recomputed missing and poor-quality evidence returned with the answer', async () => {
    const evidenceRequest = syntheticEvidenceRequest({ crew: 'B', day: 70, heartRate: null, sleepHours: null, reactionMedianMs: null });
    const evidence = await createMockExtensionClient().assessEvidence(evidenceRequest);
    const fake = fakeAssistant((r) => Promise.resolve({ ...answer(r), evidence }));
    render(<AiCompanion contexts={contexts()} client={fake.client} />);
    fireEvent.click(screen.getByRole('button', { name: 'What evidence is missing?' }));
    const shown = await screen.findByTestId('assistant-assessments');
    expect(within(shown).getByTestId('evidence-result')).toBeInTheDocument();
    for (const item of evidence.evidence.filter((e) => e.status !== 'available')) {
      expect(within(shown).getByText((_, el) => el?.getAttribute('data-kind') === item.kind)).toBeInTheDocument();
    }
    expect(evidence.evidence.some((e) => e.status === 'missing_data')).toBe(true);
    expect(within(shown).getAllByText('Missing').length).toBeGreaterThan(0);
  });

  test('without a connected backend nothing is sent and no answer is simulated', () => {
    render(<AiCompanion contexts={contexts()} client={notConnectedAssistantClient} />);
    expect(screen.getByTestId('assistant-not-connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'What evidence is missing?' })).toBeDisabled();
    expect(screen.queryByTestId('assistant-answer')).toBeNull();
  });

  test('uses the raw requests behind the synthetic results currently shown', async () => {
    const user = userEvent.setup();
    const fake = fakeAssistant((r) => Promise.resolve(answer(r)));
    render(<FatigueView client={createMockExtensionClient()} assistantClient={fake.client} storage={null} />);
    await user.click(screen.getByRole('button', { name: 'Synthetic crew member reports fatigue' }));
    await screen.findByTestId('evidence-result');
    await waitFor(() =>
      expect(screen.getByTestId('assistant-context')).toHaveTextContent('Evidence Navigator result: included'),
    );

    await user.click(screen.getByRole('button', { name: 'What evidence is missing?' }));
    await screen.findByTestId('assistant-answer');
    const sent = fake.requests[0];
    expect(sent?.subject_id).toBe(syntheticSubjectId('B'));
    expect(sent?.evidence?.subject_id).toBe(syntheticSubjectId('B'));
    expect(sent?.evidence?.mode).toBe('simulation');
    expect(sent?.evidence?.as_of).toBe(sent?.as_of);
    expect(sent?.cognitive).toBeNull();
  });
});

describe('AI Companion read-aloud', () => {
  function stubSpeech() {
    const speak = vi.fn();
    const cancel = vi.fn();
    class Utterance {
      text: string;
      lang = '';
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    vi.stubGlobal('speechSynthesis', { speak, cancel });
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
    return { speak, cancel };
  }

  test('speaks only when clicked, stops on request and on unmount', async () => {
    const speech = stubSpeech();
    const fake = fakeAssistant((r) => Promise.resolve(answer(r, 'Spoken text')));
    const view = render(<AiCompanion contexts={contexts()} client={fake.client} />);
    fireEvent.click(screen.getByRole('button', { name: 'What evidence is missing?' }));
    await screen.findByTestId('assistant-answer');
    expect(speech.speak).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Speak answer' }));
    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(speech.speak.mock.calls[0]?.[0]).toMatchObject({ text: 'Spoken text' });
    const cancelsBeforeStop = speech.cancel.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Stop reading' }));
    expect(speech.cancel.mock.calls.length).toBe(cancelsBeforeStop + 1);
    expect(screen.getByRole('button', { name: 'Speak answer' })).toBeInTheDocument();

    const cancelsBeforeUnmount = speech.cancel.mock.calls.length;
    view.unmount();
    expect(speech.cancel.mock.calls.length).toBeGreaterThan(cancelsBeforeUnmount);
  });

  test('explains when the browser has no speech synthesis', async () => {
    vi.stubGlobal('speechSynthesis', undefined);
    vi.stubGlobal('SpeechSynthesisUtterance', undefined);
    const fake = fakeAssistant((r) => Promise.resolve(answer(r)));
    render(<AiCompanion contexts={contexts()} client={fake.client} />);
    fireEvent.click(screen.getByRole('button', { name: 'What evidence is missing?' }));
    await screen.findByTestId('assistant-answer');
    expect(screen.queryByRole('button', { name: 'Speak answer' })).toBeNull();
    expect(screen.getByText('Read-aloud is not available in this browser.')).toBeInTheDocument();
  });
});
