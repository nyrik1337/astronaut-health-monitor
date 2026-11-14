import { requestJson } from '../api/client';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../config';
import { assessEvidenceMock } from './mockEvidence';
import { analyzeCognitiveMock } from './mockCognitive';
import { cognitiveResponseSchema, evidenceResponseSchema } from './schemas';
import type { CognitiveRequest, CognitiveResponse, EvidenceRequest, EvidenceResponse } from './types';

/**
 * Client for POST /api/evidence/assess and POST /api/cognitive/analyze.
 *
 * Until the backend implements these routes, the app uses a contract-based mock that follows the
 * published rules (`mock`). Set VITE_EXTENSION_API=backend to call the real routes; the UI always
 * shows which one is in use.
 */
export type ExtensionSource = 'mock' | 'backend';

export interface ExtensionClient {
  readonly source: ExtensionSource;
  assessEvidence(request: EvidenceRequest, signal?: AbortSignal): Promise<EvidenceResponse>;
  analyzeCognitive(request: CognitiveRequest, signal?: AbortSignal): Promise<CognitiveResponse>;
}

export interface HttpExtensionClientOptions {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly fetchImpl?: typeof fetch;
}

export function createHttpExtensionClient(options: HttpExtensionClientOptions): ExtensionClient {
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  return {
    source: 'backend',
    assessEvidence: (request, signal) =>
      requestJson(
        {
          url: `${options.baseUrl}/api/evidence/assess`,
          method: 'POST',
          body: JSON.stringify(request),
          schema: evidenceResponseSchema,
          signal,
        },
        fetchImpl,
        options.timeoutMs,
      ),
    analyzeCognitive: (request, signal) =>
      requestJson(
        {
          url: `${options.baseUrl}/api/cognitive/analyze`,
          method: 'POST',
          body: JSON.stringify(request),
          schema: cognitiveResponseSchema,
          signal,
        },
        fetchImpl,
        options.timeoutMs,
      ),
  };
}

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('The request was aborted.', 'AbortError');
}

/** Mock that evaluates requests with the contract rules; receipt time is injectable for tests. */
export function createMockExtensionClient(now: () => number = () => Date.now()): ExtensionClient {
  return {
    source: 'mock',
    assessEvidence: async (request, signal) => {
      abortIfNeeded(signal);
      const response = assessEvidenceMock(request, now());
      abortIfNeeded(signal);
      return evidenceResponseSchema.parse(response);
    },
    analyzeCognitive: async (request, signal) => {
      abortIfNeeded(signal);
      const response = analyzeCognitiveMock(request, now());
      abortIfNeeded(signal);
      return cognitiveResponseSchema.parse(response);
    },
  };
}

export function resolveExtensionSource(raw: string | undefined): ExtensionSource {
  return raw?.trim() === 'backend' ? 'backend' : 'mock';
}

export const extensionClient: ExtensionClient =
  resolveExtensionSource(import.meta.env.VITE_EXTENSION_API) === 'backend'
    ? createHttpExtensionClient({ baseUrl: API_BASE_URL, timeoutMs: REQUEST_TIMEOUT_MS })
    : createMockExtensionClient();
