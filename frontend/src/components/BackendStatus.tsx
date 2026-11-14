import { errorTitle } from '../api/errors';
import type { HealthState } from '../hooks/useBackendHealth';

type Props = {
  state: HealthState;
  baseUrl: string;
  onRecheck: () => void;
};

function statusText(state: HealthState): string {
  switch (state.phase) {
    case 'checking':
      return 'Checking backend…';
    case 'online':
      return `Backend online · ${state.health.service} ${state.health.version}`;
    case 'offline':
      return `${errorTitle(state.error)}: ${state.error.message}`;
  }
}

export function BackendStatus({ state, baseUrl, onRecheck }: Props) {
  return (
    <div className="backend-status" data-phase={state.phase}>
      <span className="backend-status__marker" aria-hidden="true" />
      <p role="status" aria-live="polite" className="backend-status__text">
        {statusText(state)}
        <span className="muted"> · {baseUrl}</span>
      </p>
      {state.phase === 'offline' && (
        <button type="button" className="button button--small" onClick={onRecheck}>
          Check again
        </button>
      )}
    </div>
  );
}
