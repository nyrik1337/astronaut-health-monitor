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

/**
 * Re-analyzes whenever `request` changes (pass a memoized request). An in-flight request is
 * aborted when a newer one starts or the component unmounts, so stale results never land.
 */
export function useAnalysis(client: ApiClient, request: AnalyzeRequest | null): UseAnalysisResult {
  const [state, setState] = useState<AnalysisState>({ phase: 'idle' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (request === null) {
      setState({ phase: 'idle' });
      return undefined;
    }
    const controller = new AbortController();
    setState({ phase: 'loading' });
    client.analyze(request, controller.signal).then(
      (data) => setState({ phase: 'success', data }),
      (error: unknown) => {
        if (!isAbortError(error)) {
          setState({ phase: 'error', error: toApiError(error) });
        }
      },
    );
    return () => controller.abort();
  }, [client, request, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { state, retry };
}
