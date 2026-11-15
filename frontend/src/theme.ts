/**
 * SpaceKitty light/dark themes. CSS tokens live in spacekitty.css; chart colours are mirrored
 * here because Recharts writes them into SVG presentation attributes, where CSS custom
 * properties are not reliably resolved. The chosen theme lives in React memory only.
 */
import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeId = 'light' | 'dark';

export const CHART_THEMES = {
  light: { ink: '#21252A', muted: '#666E72', rule: '#D5D1C7', accent: '#566CA5', surface: '#F6F3EC' },
  dark: { ink: '#F1EEE7', muted: '#B1B9C1', rule: '#414751', accent: '#A6B8F0', surface: '#191E26' },
} as const;

/** Light palette, kept for callers outside the provider. */
export const CHART_COLORS = CHART_THEMES.light;

interface ThemeState {
  readonly theme: ThemeId;
  readonly setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeState>({ theme: 'light', setTheme: () => undefined });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeId>('light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return createElement(ThemeContext.Provider, { value }, children);
}

export const useTheme = (): ThemeState => useContext(ThemeContext);

export function useChartColors() {
  return CHART_THEMES[useTheme().theme];
}
