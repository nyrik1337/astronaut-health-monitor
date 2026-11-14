import type { ValidationDetail } from './types';

/**
 * - `http`: the backend answered with a non-2xx status (contract error envelope or not).
 * - `network`: the request never got a response (backend down, CORS, DNS).
 * - `timeout`: no response within the client timeout.
 * - `invalid_response`: a 2xx body that does not match the API contract.
 * - `unexpected`: anything else thrown on the client side.
 */
export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'invalid_response' | 'unexpected';

export interface ApiErrorInit {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly message: string;
  readonly details?: readonly ValidationDetail[];
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly details: readonly ValidationDetail[];

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
  }
}

export function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  return new ApiError({
    kind: 'unexpected',
    status: null,
    code: 'CLIENT_ERROR',
    message: 'Something went wrong in the dashboard while contacting the backend.',
  });
}

export function errorTitle(error: ApiError): string {
  switch (error.kind) {
    case 'network':
      return 'Backend unreachable';
    case 'timeout':
      return 'Backend did not respond';
    case 'invalid_response':
      return 'Unexpected response from backend';
    case 'unexpected':
      return 'Unexpected error';
    case 'http':
      return error.status === 422 ? 'Request rejected by validation' : `Backend error (HTTP ${error.status ?? '?'})`;
  }
}
