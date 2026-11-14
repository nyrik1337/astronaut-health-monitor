import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '../api/client';
import { type ApiError, isAbortError, toApiError } from '../api/errors';
import type { HealthResponse } from '../api/types';

export type HealthState =
  | { readonly phase: 'checking' }
  | { readonly phase: 'online'; readonly health: HealthResponse }
  | { readonly phase: 'offline'; readonly error: ApiError };

export interface UseBackendHealthResult {
  readonly state: HealthState;
  readonly recheck: () => void;
}

/** Calls GET /health on mount and whenever `recheck` is invoked. */
export function useBackendHealth(client: ApiClient): UseBackendHealthResult {
  const [state, setState] = useState<HealthState>({ phase: 'checking' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ phase: 'checking' });
    client.getHealth(controller.signal).then(
      (health) => setState({ phase: 'online', health }),
      (error: unknown) => {
        if (!isAbortError(error)) {
          setState({ phase: 'offline', error: toApiError(error) });
        }
      },
    );
    return () => controller.abort();
  }, [client, attempt]);

  const recheck = useCallback(() => setAttempt((count) => count + 1), []);
  return { state, recheck };
}
