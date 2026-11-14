import { ErrorNotice } from '../components/ErrorNotice';
import type { CallState } from './useExtensionCall';

/** Loading and error states of one extension request; results are rendered by the caller. */
export function CallStatus<T>({ state, label, onRetry }: { state: CallState<T>; label: string; onRetry: () => void }) {
  if (state.phase === 'loading') return <p className="muted">{label}…</p>;
  if (state.phase === 'error') return <ErrorNotice error={state.error} onRetry={onRetry} />;
  return null;
}
