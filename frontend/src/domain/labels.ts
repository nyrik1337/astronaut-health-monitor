import type { AnalysisStatus, MetricResult, MetricStatus } from '../api/types';

/**
 * Display text for contract statuses. These describe data sufficiency and baseline
 * comparison only — they are not health or severity classes.
 */

export const METRIC_STATUS_LABELS: Readonly<Record<MetricStatus, string>> = {
  analyzed: 'Analyzed',
  zero_variability: 'Zero variability',
  insufficient_history: 'Insufficient history',
  missing_current: 'No current value',
};

export const ANALYSIS_STATUS_LABELS: Readonly<Record<AnalysisStatus, string>> = {
  complete: 'Complete',
  partial: 'Partial',
  insufficient_history: 'Insufficient history',
  no_current_data: 'No current data',
};

export const ANALYSIS_STATUS_DESCRIPTIONS: Readonly<Record<AnalysisStatus, string>> = {
  complete: 'Every metric was compared with its personal baseline.',
  partial: 'Some metrics were compared with their personal baseline; others lack a current value or enough history.',
  insufficient_history: 'No metric has enough valid history values for a baseline yet.',
  no_current_data: 'All current measurement values are missing.',
};

const BASELINE_METHOD_LABELS: Readonly<Record<string, string>> = {
  median_mad: 'Median and median absolute deviation (MAD)',
};

export function baselineMethodLabel(method: string): string {
  return BASELINE_METHOD_LABELS[method] ?? method;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function describeMetricResult(result: MetricResult, minimumSamples: number): string {
  const samples = plural(result.history_samples, 'valid history value');
  switch (result.status) {
    case 'analyzed':
      return `Compared with the median of ${samples}.`;
    case 'zero_variability':
      return `Compared with the median of ${samples}. MAD is zero, so a robust z-score cannot be calculated.`;
    case 'insufficient_history':
      return `${samples} on record; at least ${minimumSamples} are needed for a baseline in this demonstration.`;
    case 'missing_current':
      return `The current reading has no value for this metric. ${samples} on record.`;
  }
}
