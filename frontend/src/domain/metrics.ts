export interface MetricDefinition {
  readonly key: string;
  readonly label: string;
  readonly unit: string;
  /** Decimal places used when displaying values of this metric. */
  readonly decimals: number;
}

/** The initial demo metrics named in docs/API_CONTRACT.md, in display order. */
export const DEMO_METRICS: readonly MetricDefinition[] = [
  { key: 'heart_rate_bpm', label: 'Heart rate', unit: 'bpm', decimals: 0 },
  { key: 'spo2_percent', label: 'SpO₂', unit: '%', decimals: 0 },
  { key: 'body_temperature_c', label: 'Body temperature', unit: '°C', decimals: 1 },
];

const FALLBACK_DECIMALS = 2;

/** Other valid metric names remain supported by the API; show them by their raw key. */
export function getMetricDefinition(key: string): MetricDefinition {
  return (
    DEMO_METRICS.find((metric) => metric.key === key) ?? {
      key,
      label: key,
      unit: '',
      decimals: FALLBACK_DECIMALS,
    }
  );
}
