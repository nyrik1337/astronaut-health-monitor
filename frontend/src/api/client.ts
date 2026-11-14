import type { ZodType } from 'zod';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../config';
import { ApiError } from './errors';
import { analyzeResponseSchema, errorEnvelopeSchema, healthResponseSchema } from './schemas';
import type { AnalyzeRequest, AnalyzeResponse, HealthResponse } from './types';

export interface ApiClient {
  readonly baseUrl: string;
  getHealth(signal?: AbortSignal): Promise<HealthResponse>;
  analyze(request: AnalyzeRequest, signal?: AbortSignal): Promise<AnalyzeResponse>;
}

export interface ApiClientOptions {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly fetchImpl?: typeof fetch;
}

interface RequestSpec<T> {
  readonly url: string;
  readonly method: 'GET' | 'POST';
  readonly body?: string;
  readonly schema: ZodType<T>;
  readonly signal?: AbortSignal;
}

interface RawResponse {
  readonly status: number;
  readonly ok: boolean;
  readonly body: unknown;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const send = <T>(spec: RequestSpec<T>): Promise<T> => requestJson(spec, fetchImpl, options.timeoutMs);

  return {
    baseUrl: options.baseUrl,
    getHealth: (signal) =>
      send({ url: `${options.baseUrl}/health`, method: 'GET', schema: healthResponseSchema, signal }),
    analyze: (request, signal) =>
      send({
        url: `${options.baseUrl}/api/analyze`,
        method: 'POST',
        body: JSON.stringify(request),
        schema: analyzeResponseSchema,
        signal,
      }),
  };
}

async function requestJson<T>(spec: RequestSpec<T>, fetchImpl: typeof fetch, timeoutMs: number): Promise<T> {
  const raw = await fetchWithTimeout(spec, fetchImpl, timeoutMs);
  if (!raw.ok) {
    throw toHttpError(raw);
  }
  const parsed = spec.schema.safeParse(raw.body);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'invalid_response',
      status: raw.status,
      code: 'INVALID_RESPONSE',
      message: 'The backend response does not match the API contract.',
    });
  }
  return parsed.data;
}

async function fetchWithTimeout<T>(
  spec: RequestSpec<T>,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<RawResponse> {
  if (spec.signal?.aborted) {
    throw abortError();
  }
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = (): void => controller.abort();
  spec.signal?.addEventListener('abort', forwardAbort, { once: true });

  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (spec.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetchImpl(spec.url, {
      method: spec.method,
      headers,
      body: spec.body,
      signal: controller.signal,
    });
    const body = await readJsonBody(response);
    return { status: response.status, ok: response.ok, body };
  } catch (error: unknown) {
    throw classifyFetchFailure(error, spec.signal, timedOut, timeoutMs);
  } finally {
    clearTimeout(timer);
    spec.signal?.removeEventListener('abort', forwardAbort);
  }
}

function classifyFetchFailure(
  error: unknown,
  callerSignal: AbortSignal | undefined,
  timedOut: boolean,
  timeoutMs: number,
): Error {
  if (callerSignal?.aborted) {
    return abortError();
  }
  if (timedOut) {
    return new ApiError({
      kind: 'timeout',
      status: null,
      code: 'TIMEOUT',
      message: `No response from the backend within ${timeoutMs / 1000} seconds.`,
    });
  }
  if (error instanceof ApiError) {
    return error;
  }
  return new ApiError({
    kind: 'network',
    status: null,
    code: 'NETWORK_ERROR',
    message: 'Could not reach the backend. Check that it is running and that its CORS policy allows this origin.',
  });
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // A non-JSON body is reported by the caller as an HTTP or contract error.
    return undefined;
  }
}

function toHttpError(raw: RawResponse): ApiError {
  const envelope = errorEnvelopeSchema.safeParse(raw.body);
  if (envelope.success) {
    return new ApiError({
      kind: 'http',
      status: raw.status,
      code: envelope.data.error.code,
      message: envelope.data.error.message,
      details: envelope.data.error.details,
    });
  }
  return new ApiError({
    kind: 'http',
    status: raw.status,
    code: `HTTP_${raw.status}`,
    message: `The backend returned HTTP ${raw.status} without a contract error body.`,
  });
}

function abortError(): DOMException {
  return new DOMException('The request was aborted.', 'AbortError');
}

export const apiClient: ApiClient = createApiClient({
  baseUrl: API_BASE_URL,
  timeoutMs: REQUEST_TIMEOUT_MS,
});
