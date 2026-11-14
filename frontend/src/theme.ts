/**
 * Chart colours mirrored from the CSS tokens in styles.css. Recharts writes these into SVG
 * presentation attributes, where CSS custom properties are not reliably resolved.
 */
export const CHART_COLORS = {
  ink: '#111111',
  muted: '#5B5B60',
  rule: '#E3E3E6',
  accent: '#002FA7',
  surface: '#FFFFFF',
} as const;
