/**
 * Chart colours mirrored from the CSS tokens in styles.css. Recharts writes these into SVG
 * presentation attributes, where CSS custom properties are not reliably resolved.
 */
export const CHART_COLORS = {
  ink: '#E8ECF4',
  muted: '#9AA4B5',
  rule: '#222A3A',
  accent: '#6B9DFF',
  surface: '#07090F',
} as const;
