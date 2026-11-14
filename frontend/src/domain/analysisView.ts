import type { AnalyzeResponse, MetricResult } from '../api/types';
import type { AnalysisState } from '../hooks/useAnalysis';
import { isSameInstant } from './format';
import type { Reading } from './readings';

export type MetricAnalysisView =
  | { readonly kind: 'pending' }
  | { readonly kind: 'unavailable'; readonly reason: string }
  | { readonly kind: 'ready'; readonly result: MetricResult; readonly minimumSamples: number };

/**
 * The analysis that belongs to the reading currently on screen, or null.
 * Guards against showing the previous reading's result during the render before a new request starts.
 */
export function analysisForReading(state: AnalysisState, current: Reading | null): AnalyzeResponse | null {
  if (state.phase !== 'success' || current === null) {
    return null;
  }
  return isSameInstant(state.data.timestamp, current.timestamp) ? state.data : null;
}

export function metricAnalysisView(
  state: AnalysisState,
  analysis: AnalyzeResponse | null,
  metricKey: string,
): MetricAnalysisView {
  if (analysis !== null) {
    const result = analysis.metrics[metricKey];
    return result === undefined
      ? { kind: 'unavailable', reason: 'This metric is not part of the analysis response.' }
      : { kind: 'ready', result, minimumSamples: analysis.minimum_history_samples };
  }
  if (state.phase === 'error') {
    return { kind: 'unavailable', reason: 'Analysis failed. See the error in the Analysis section.' };
  }
  if (state.phase === 'idle') {
    return { kind: 'unavailable', reason: 'There is no reading to analyze.' };
  }
  return { kind: 'pending' };
}

/** Signed difference current − median, from the response's absolute deviation. */
export function signedDifference(result: MetricResult): number | null {
  if (result.deviation === null || result.baseline === null || result.current === null) {
    return null;
  }
  const direction = Math.sign(result.current - result.baseline.median);
  return direction * result.deviation.absolute;
}
