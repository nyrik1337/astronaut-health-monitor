import type { ApiError } from '../api/errors';
import { useT, type TFn } from '../i18n';

/** Translated error heading; the message and codes below it stay as received. */
export function localizedErrorTitle(error: ApiError, t: TFn): string {
  if (error.kind !== 'http') return t(`error.${error.kind}`);
  return error.status === 422 ? t('error.validation') : t('error.http', { status: error.status ?? '?' });
}

type Props = {
  error: ApiError;
  onRetry: () => void;
};

export function ErrorNotice({ error, onRetry }: Props) {
  const { t } = useT();
  const statusText = error.status === null ? error.code : `${error.code} · HTTP ${error.status}`;
  return (
    <div className="error-notice" role="alert">
      <p className="error-notice__title">{localizedErrorTitle(error, t)}</p>
      <p>{error.message}</p>
      {error.details.length > 0 && (
        <ul className="error-notice__details">
          {error.details.map((detail) => (
            <li key={`${detail.field}-${detail.code}`}>
              <code>{detail.field}</code> {detail.message} <span className="muted">({detail.code})</span>
            </li>
          ))}
        </ul>
      )}
      <p className="error-notice__code muted">{statusText}</p>
      <button type="button" className="button" onClick={onRetry}>
        {t('error.retry')}
      </button>
    </div>
  );
}
