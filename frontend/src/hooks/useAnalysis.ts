import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '../api/client';
import { type ApiError, isAbortError, toApiError } from '../api/errors';
import type { AnalyzeRequest, AnalyzeResponse } from '../api/types';

export type AnalysisState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'loading' }
  | { readonly phase: 'success'; readonly data: AnalyzeResponse }
  | { readonly phase: 'error'; readonly error: ApiError };

export interface UseAnalysisResult {
  readonly state: AnalysisState;
  readonly retry: () => void;
}

interface RequestState {
  readonly request: AnalyzeRequest | null;
  readonly attempt: number;
  readonly state: AnalysisState;
}

/**
 * Re-analyzes whenever `request` changes (pass a memoized request). An in-flight request is
 * aborted when a newer one starts or the component unmounts, so stale results never land.
 */
export function useAnalysis(client: ApiClient, request: AnalyzeRequest | null): UseAnalysisResult {
  const [result, setResult] = useState<RequestState>({
    request: null,
    attempt: 0,
    state: { phase: 'idle' },
  });
  const [attempt, setAttempt] = useState(0);

  const state: AnalysisState = result.request === request && result.attempt === attempt
    ? result.state
    : request === null
      ? { phase: 'idle' }
      : { phase: 'loading' };

  useEffect(() => {
    if (request === null) {
      setResult({ request, attempt, state: { phase: 'idle' } });
      return undefined;
    }
    const controller = new AbortController();
    let active = true;
    setResult({ request, attempt, state: { phase: 'loading' } });
    client.analyze(request, controller.signal).then(
      (data) => {
        if (active) setResult({ request, attempt, state: { phase: 'success', data } });
      },
      (error: unknown) => {
        if (active && !isAbortError(error)) {
          setResult({ request, attempt, state: { phase: 'error', error: toApiError(error) } });
        }
      },
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [client, request, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { state, retry };
}
