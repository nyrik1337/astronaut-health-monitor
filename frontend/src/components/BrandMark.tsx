import { useT } from '../i18n';
import { useTheme, type ThemeId } from '../theme';

/**
 * SpaceKitty identity: a small orbit whose ring carries two ear-like notches, with one satellite
 * in motion. Original line art; decorative only (the wordmark carries the name).
 */
export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path className="brand-mark__ring" d="M9 18 L13 7 L19 13 A16 16 0 0 1 29 13 L35 7 L39 18 A16 16 0 1 1 9 18 Z" />
      <circle className="brand-mark__core" cx="24" cy="28" r="3" />
      <g className="brand-mark__orbit">
        <circle cx="24" cy="10.5" r="2.4" />
      </g>
    </svg>
  );
}

const THEMES: readonly { readonly id: ThemeId; readonly glyph: string }[] = [
  { id: 'light', glyph: '☀' },
  { id: 'dark', glyph: '☾' },
];

/** Light / dark switch. Only CSS tokens change, so no view state is reset. */
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const { t } = useT();
  return (
    <div className="lang-switch" role="group" aria-label={t('shell.theme')}>
      {THEMES.map((option) => (
        <button
          key={option.id}
          type="button"
          className="lang-switch__option"
          aria-pressed={theme === option.id}
          aria-label={t(`shell.theme.${option.id}`)}
          onClick={() => setTheme(option.id)}
        >
          <span aria-hidden="true">{option.glyph}</span>
        </button>
      ))}
    </div>
  );
}
