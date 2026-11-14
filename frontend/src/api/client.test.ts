import { describe, expect, test, vi } from 'vitest';
import { HEALTH_OK, jsonResponse, partialResponse } from '../test/fixtures';
import { createApiClient } from './client';
import { ApiError, errorTitle, isAbortError, toApiError } from './errors';
import type { AnalyzeRequest } from './types';

const REQUEST: AnalyzeRequest = {
  subject_id: 'demo-subject-01',
  timestamp: '2026-10-04T14:30:00Z',
  measurements: { heart_rate_bpm: 74, spo2_percent: null },
  history: [{ timestamp: '2026-10-04T13:30:00Z', measurements: { heart_rate_bpm: 71 } }],
};

function clientWith(fetchImpl: typeof fetch, timeoutMs = 1000) {
  return createApiClient({ baseUrl: 'http://backend.test', timeoutMs, fetchImpl });
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error: unknown) {
    return error;
  }
  throw new Error('Expected the promise to reject.');
}

function neverResolvingFetch() {
  return vi.fn<typeof fetch>(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
  );
}

describe('getHealth', () => {
  test('GETs /health and returns the parsed body', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, HEALTH_OK));

    const health = await clientWith(fetchImpl).getHealth();

    expect(health).toEqual(HEALTH_OK);
    expect(fetchImpl).toHaveBeenCalledWith('http://backend.test/health', expect.objectContaining({ method: 'GET' }));
  });
});

describe('analyze', () => {
  test('POSTs the request as JSON to /api/analyze, preserving null measurements', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, partialResponse(REQUEST.timestamp)));

    const result = await clientWith(fetchImpl).analyze(REQUEST);

    expect(result.analysis_status).toBe('partial');
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('http://backend.test/api/analyze');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json', Accept: 'application/json' });
    expect(JSON.parse(String(init?.body))).toEqual(REQUEST);
  });

  test('maps a 422 contract error envelope to an ApiError with validation details', async () => {
    const envelope = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        details: [{ field: 'history.2.timestamp', code: 'DUPLICATE_TIMESTAMP', message: 'Historical timestamps must be unique.' }],
      },
    };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(422, envelope));

    const error = await captureError(clientWith(fetchImpl).analyze(REQUEST));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'http', status: 422, code: 'VALIDATION_ERROR', details: envelope.error.details });
  });

  test('reports a non-envelope error body with an HTTP_<status> code', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));

    const error = await captureError(clientWith(fetchImpl).analyze(REQUEST));

    expect(error).toMatchObject({ kind: 'http', status: 502, code: 'HTTP_502', details: [] });
  });

  test('rejects a 200 body that does not match the contract', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, { analysis_status: 'healthy' }));

    const error = await captureError(clientWith(fetchImpl).analyze(REQUEST));

    expect(error).toMatchObject({ kind: 'invalid_response', code: 'INVALID_RESPONSE' });
  });

  test('rejects a 200 response with an empty body', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 200 }));

    const error = await captureError(clientWith(fetchImpl).getHealth());

    expect(error).toMatchObject({ kind: 'invalid_response' });
  });

  test('reports an unreachable backend as a network error', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await captureError(clientWith(fetchImpl).analyze(REQUEST));

    expect(error).toMatchObject({ kind: 'network', code: 'NETWORK_ERROR', status: null });
  });

  test('times out when the backend never answers', async () => {
    const error = await captureError(clientWith(neverResolvingFetch(), 10).analyze(REQUEST));

    expect(error).toMatchObject({ kind: 'timeout', code: 'TIMEOUT' });
  });

  test('propagates caller cancellation as an AbortError, not an ApiError', async () => {
    const controller = new AbortController();

    const pending = clientWith(neverResolvingFetch()).analyze(REQUEST, controller.signal);
    controller.abort();
    const error = await captureError(pending);

    expect(isAbortError(error)).toBe(true);
    expect(error).not.toBeInstanceOf(ApiError);
  });

  test('does not call fetch when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn<typeof fetch>();

    const error = await captureError(clientWith(fetchImpl).analyze(REQUEST, controller.signal));

    expect(isAbortError(error)).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('error helpers', () => {
  test('toApiError wraps unknown values and passes ApiErrors through', () => {
    const existing = new ApiError({ kind: 'network', status: null, code: 'NETWORK_ERROR', message: 'x' });

    expect(toApiError(existing)).toBe(existing);
    expect(toApiError(new Error('boom'))).toMatchObject({ kind: 'unexpected', code: 'CLIENT_ERROR' });
  });

  test('errorTitle gives a readable title for each error kind', () => {
    const make = (kind: ApiError['kind'], status: number | null = null) =>
      errorTitle(new ApiError({ kind, status, code: 'C', message: 'm' }));

    expect(make('network')).toBe('Backend unreachable');
    expect(make('timeout')).toBe('Backend did not respond');
    expect(make('invalid_response')).toBe('Unexpected response from backend');
    expect(make('unexpected')).toBe('Unexpected error');
    expect(make('http', 422)).toBe('Request rejected by validation');
    expect(make('http', 500)).toBe('Backend error (HTTP 500)');
  });
});
