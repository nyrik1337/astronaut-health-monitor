export const DEFAULT_API_BASE_URL = 'http://localhost:8000';

/** Client-side request timeout. A stuck backend must not leave the UI loading forever. */
export const REQUEST_TIMEOUT_MS = 10_000;

/** docs/API_CONTRACT.md: `history` may contain at most 1,000 records. */
export const MAX_HISTORY_RECORDS = 1000;

export function resolveApiBaseUrl(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (trimmed === '') {
    return DEFAULT_API_BASE_URL;
  }
  return trimmed.replace(/\/+$/, '');
}

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
