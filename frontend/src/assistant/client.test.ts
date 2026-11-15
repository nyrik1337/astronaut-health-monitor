import { describe, expect, test, vi } from 'vitest';
import { ApiError } from '../api/errors';
import { createMockExtensionClient } from '../cognitive/client';
import { syntheticEvidenceRequest } from '../cognitive/syntheticStore';
import { createHttpAssistantClient, resolveAssistantClient } from './client';
import { buildAssistantRequest } from './context';
import { assistantResponseSchema } from './schemas';
import type { AssistantRequest } from './types';

// The 200 example of contract `assistant-1` (docs/API_CONTRACT.md @ ef72e6f), verbatim.
const CONTRACT_REQUEST: AssistantRequest = {
  subject_id: 'sim-crew-01',
  mode: 'simulation',
  clock: { kind: 'mission', id: 'mission-500' },
  as_of: '2026-11-14T10:00:00Z',
  question: 'What can you tell me about fatigue with the available data?',
  evidence: null,
  cognitive: null,
  gentle_breathing_available: false,
};
const CONTRACT_RESPONSE = {
  subject_id: 'sim-crew-01',
  mode: 'simulation',
  clock: { kind: 'mission', id: 'mission-500' },
  as_of: '2026-11-14T10:00:00Z',
  answer:
    'This is a synthetic demonstration. No observations or cognitive result were supplied, so I cannot explain fatigue from measurements or compare with a personal baseline. A voluntary cognitive check can describe recorded performance, with experimental limitations.',
  model: 'qwen3:4b-instruct',
  generation: 'local_ollama',
  provenance: 'synthetic_demonstration',
  evidence: null,
  cognitive: null,
  limitations: [
    'Synthetic demonstration only; not a real participant assessment.',
    'AI-generated explanations are unvalidated; deterministic assessment results remain authoritative.',
    'No Evidence Navigator assessment was supplied.',
    'No CognitiveGuard assessment or personal baseline was supplied.',
  ],
  disclaimer:
    'Not a medical diagnosis or fitness-for-duty assessment. For serious or urgent symptoms, contact qualified crew medical personnel and follow approved procedures.',
  truncated: false,
};

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('AI Companion HTTP adapter (contract assistant-1)', () => {
  test('VITE_ASSISTANT_API=backend enables the real adapter; anything else stays not connected', () => {
    expect(resolveAssistantClient('backend').status).toBe('backend');
    expect(resolveAssistantClient(' Backend ').status).toBe('backend');
    expect(resolveAssistantClient(undefined).status).toBe('not_connected');
    expect(resolveAssistantClient('mock').status).toBe('not_connected');
  });

  test('posts the request as JSON to /api/assistant/chat and accepts the contract example response', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, CONTRACT_RESPONSE)));
    const client = createHttpAssistantClient({ baseUrl: 'http://localhost:8000', fetchImpl });
    const response = await client.chat(CONTRACT_REQUEST);

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('http://localhost:8000/api/assistant/chat');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual(CONTRACT_REQUEST);
    expect(response).toEqual(CONTRACT_RESPONSE);
  });

  test('accepts populated recomputed assessments and rejects unknown fields', async () => {
    const evidenceRequest = syntheticEvidenceRequest({ crew: 'B', day: 70, heartRate: null, sleepHours: null, reactionMedianMs: null });
    const evidence = await createMockExtensionClient().assessEvidence(evidenceRequest);
    const populated = { ...CONTRACT_RESPONSE, subject_id: evidence.subject_id, evidence };
    expect(assistantResponseSchema.safeParse(populated).success).toBe(true);
    expect(assistantResponseSchema.safeParse({ ...CONTRACT_RESPONSE, extra: 1 }).success).toBe(false);
    expect(assistantResponseSchema.safeParse({ ...CONTRACT_RESPONSE, generation: 'cloud' }).success).toBe(false);
  });

  test.each([
    [503, 'ASSISTANT_UNAVAILABLE'],
    [503, 'ASSISTANT_BUSY'],
    [504, 'ASSISTANT_TIMEOUT'],
    [502, 'ASSISTANT_INVALID_RESPONSE'],
    [500, 'ASSISTANT_CONFIGURATION_ERROR'],
  ])('turns the %i %s envelope into an error, not an answer', async (status, code) => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(jsonResponse(status, { error: { code, message: 'stable message', details: [] } })),
    );
    const client = createHttpAssistantClient({ baseUrl: 'http://localhost:8000', fetchImpl });
    const failure = await client.chat(CONTRACT_REQUEST).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ kind: 'http', status, code });
  });

  test('aligns every enclosing as_of to one instant without redating observations', () => {
    const evidence = syntheticEvidenceRequest({ crew: 'B', day: 70, heartRate: 72, sleepHours: null, reactionMedianMs: null });
    const real = { ...evidence, subject_id: 'participant-01', mode: 'real_assessment' as const, clock: { kind: 'utc' as const, id: 'utc' } };
    const request = buildAssistantRequest(
      { subject_id: 'participant-01', mode: 'real_assessment', clock: { kind: 'utc', id: 'utc' }, as_of: real.as_of, evidence: real, cognitive: null },
      ' Why? ',
      Date.parse('2026-11-15T06:00:00.123Z'),
      true,
    );
    expect(request.as_of).toBe('2026-11-15T06:00:00.123Z');
    expect(request.evidence?.as_of).toBe(request.as_of);
    expect(request.evidence?.observations).toEqual(real.observations);
    expect(request.evidence?.reported_issue).toEqual(real.reported_issue);
    expect(request.question).toBe('Why?');
  });
});
