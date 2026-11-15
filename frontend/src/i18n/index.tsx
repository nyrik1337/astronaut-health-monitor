/**
 * Lightweight EN/RU translation layer: typed keys, `{name}` interpolation, no dependencies.
 * The language lives in React memory only (no storage), English is the default, and components
 * rendered without a provider — e.g. in unit tests — get English.
 *
 * Only interface text is translated. API field names, enum values, timestamps, numbers and any
 * prose computed by the backend (or its contract-based mock) are passed through untouched.
 */
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en, ru } from './dictionaries';

export type Lang = 'en' | 'ru';
export type TKey = keyof typeof en;
export type Vars = Readonly<Record<string, string | number>>;
export type TFn = (key: TKey, vars?: Vars) => string;

export const LANGUAGES: readonly { readonly id: Lang; readonly label: string; readonly name: string }[] = [
  { id: 'en', label: 'EN', name: 'English' },
  { id: 'ru', label: 'RU', name: 'Русский' },
];

const DICTIONARIES: Record<Lang, Record<TKey, string>> = { en, ru };

/** True when `key` names an interface string (used for open-ended ids such as metric keys). */
export const isKey = (key: string): key is TKey => Object.prototype.hasOwnProperty.call(en, key);

export function translate(lang: Lang, key: TKey, vars?: Vars): string {
  const template = DICTIONARIES[lang][key];
  if (vars === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

interface LanguageState {
  readonly lang: Lang;
  readonly setLang: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageState>({ lang: 'en', setLang: () => undefined });

export function LanguageProvider({ children, initial = 'en' }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLang] = useState<Lang>(initial);
  // Keep the document language in step for screen readers; nothing is persisted.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang }), [lang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useT(): LanguageState & { readonly t: TFn } {
  const state = useContext(LanguageContext);
  const { lang } = state;
  const t = useCallback<TFn>((key, vars) => translate(lang, key, vars), [lang]);
  return { ...state, t };
}

const MARKUP = /(\*\*[^*]+\*\*|`[^`]+`|\[\[[^\]]+\]\])/g;

/** Renders a translated string with minimal markup: **strong**, `code` and [[key]]. */
export function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(MARKUP).map((part, index) => {
        if (part.startsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
        if (part.startsWith('[[')) return <kbd key={index}>{part.slice(2, -2)}</kbd>;
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}

/** EN / RU selector for the header. Switching only re-renders text; no state is reset. */
export function LanguageSwitch() {
  const { lang, setLang, t } = useT();
  return (
    <div className="lang-switch" role="group" aria-label={t('shell.language')}>
      {LANGUAGES.map((option) => (
        <button
          key={option.id}
          type="button"
          className="lang-switch__option"
          lang={option.id}
          aria-pressed={lang === option.id}
          aria-label={option.name}
          onClick={() => setLang(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
