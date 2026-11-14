import { type ApiError, errorTitle } from '../api/errors';

type Props = {
  error: ApiError;
  onRetry: () => void;
};

export function ErrorNotice({ error, onRetry }: Props) {
  const statusText = error.status === null ? error.code : `${error.code} · HTTP ${error.status}`;
  return (
    <div className="error-notice" role="alert">
      <p className="error-notice__title">{errorTitle(error)}</p>
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
        Try again
      </button>
    </div>
  );
}
