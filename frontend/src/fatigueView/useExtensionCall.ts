import { useCallback, useEffect, useRef, useState } from 'react';
import { type ApiError, isAbortError, toApiError } from '../api/errors';

/**
 * Runs one extension request at a time. Starting a new request aborts the previous one, so an
 * obsolete response can never overwrite a newer one (contract: "abort/supersede obsolete requests").
 */

export type CallState<T> =
  | { readonly phase: 'idle' }
  | { readonly phase: 'loading' }
  | { readonly phase: 'success'; readonly data: T }
  | { readonly phase: 'error'; readonly error: ApiError };

export interface UseExtensionCall<Req, Res> {
  readonly state: CallState<Res>;
  readonly run: (request: Req) => Promise<Res | null>;
  readonly reset: () => void;
}

export function useExtensionCall<Req, Res>(
  call: (request: Req, signal: AbortSignal) => Promise<Res>,
): UseExtensionCall<Req, Res> {
  const [state, setState] = useState<CallState<Res>>({ phase: 'idle' });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const run = useCallback(
    async (request: Req): Promise<Res | null> => {
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      setState({ phase: 'loading' });
      try {
        const data = await call(request, current.signal);
        if (current.signal.aborted) return null;
        setState({ phase: 'success', data });
        return data;
      } catch (error: unknown) {
        if (current.signal.aborted || isAbortError(error)) return null;
        setState({ phase: 'error', error: toApiError(error) });
        return null;
      }
    },
    [call],
  );

  const reset = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState({ phase: 'idle' });
  }, []);

  return { state, run, reset };
}
