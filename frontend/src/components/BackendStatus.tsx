import { useT, type TFn } from '../i18n';
import { localizedErrorTitle } from './ErrorNotice';
import type { HealthState } from '../hooks/useBackendHealth';

type Props = {
  state: HealthState;
  baseUrl: string;
  onRecheck: () => void;
};

function statusText(state: HealthState, t: TFn): string {
  switch (state.phase) {
    case 'checking':
      return t('backend.checking');
    case 'online':
      return `${t('backend.online')} · ${state.health.service} ${state.health.version}`;
    case 'offline':
      return `${localizedErrorTitle(state.error, t)}: ${state.error.message}`;
  }
}

export function BackendStatus({ state, baseUrl, onRecheck }: Props) {
  const { t } = useT();
  return (
    <div className="backend-status" data-phase={state.phase}>
      <span className="backend-status__marker" aria-hidden="true" />
      <p role="status" aria-live="polite" className="backend-status__text">
        {statusText(state, t)}
        <span className="muted"> · {baseUrl}</span>
      </p>
      {state.phase === 'offline' && (
        <button type="button" className="button button--small" onClick={onRecheck}>
          {t('backend.recheck')}
        </button>
      )}
    </div>
  );
}
