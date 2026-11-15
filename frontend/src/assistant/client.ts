import { requestJson } from '../api/client';
import { ApiError } from '../api/errors';
import { API_BASE_URL } from '../config';
import { assistantResponseSchema } from './schemas';
import type { AssistantRequest, AssistantResponse } from './types';

/**
 * Small typed adapter for the AI Companion. The HTTP transport follows Codex's DRAFT `assistant-1`
 * contract and is OFF by default (`not_connected`) until that contract is approved and the backend
 * route exists; set VITE_ASSISTANT_API=backend to enable it. There is deliberately no mock answer
 * outside automated tests: the demo never shows invented text as a Qwen response.
 */
export type AssistantStatus = 'not_connected' | 'backend';

export interface AssistantClient {
  readonly status: AssistantStatus;
  chat(request: AssistantRequest, signal?: AbortSignal): Promise<AssistantResponse>;
}

/** Contract default generation deadline is 120 s; allow a little more for the HTTP round trip. */
export const ASSISTANT_TIMEOUT_MS = 130_000;

export function createHttpAssistantClient(options: {
  readonly baseUrl: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}): AssistantClient {
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  return {
    status: 'backend',
    chat: (request, signal) =>
      requestJson(
        {
          url: `${options.baseUrl}/api/assistant/chat`,
          method: 'POST',
          body: JSON.stringify(request),
          schema: assistantResponseSchema,
          signal,
        },
        fetchImpl,
        options.timeoutMs ?? ASSISTANT_TIMEOUT_MS,
      ),
  };
}

export const notConnectedAssistantClient: AssistantClient = {
  status: 'not_connected',
  chat: () =>
    Promise.reject(
      new ApiError({
        kind: 'unexpected',
        status: null,
        code: 'ASSISTANT_NOT_CONNECTED',
        message: 'The AI Companion backend is not connected in this build.',
      }),
    ),
};

export function resolveAssistantClient(flag: string | undefined): AssistantClient {
  return flag?.trim().toLowerCase() === 'backend'
    ? createHttpAssistantClient({ baseUrl: API_BASE_URL })
    : notConnectedAssistantClient;
}

export const assistantClient = resolveAssistantClient(import.meta.env.VITE_ASSISTANT_API);
