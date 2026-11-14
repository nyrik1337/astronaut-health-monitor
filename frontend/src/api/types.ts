import type { z } from 'zod';
import type {
  analysisStatusSchema,
  analysisWarningSchema,
  analyzeResponseSchema,
  baselineSchema,
  deviationSchema,
  healthResponseSchema,
  metricResultSchema,
  metricStatusSchema,
  validationDetailSchema,
} from './schemas';

// ---- Response types (inferred from runtime schemas) ----

export type MetricStatus = z.infer<typeof metricStatusSchema>;
export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;
export type Baseline = z.infer<typeof baselineSchema>;
export type Deviation = z.infer<typeof deviationSchema>;
export type MetricResult = z.infer<typeof metricResultSchema>;
export type AnalysisWarning = z.infer<typeof analysisWarningSchema>;
export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ValidationDetail = z.infer<typeof validationDetailSchema>;

/** Warning codes defined for the MVP. Other strings may still arrive and are displayed verbatim. */
export type KnownWarningCode = 'ZERO_BASELINE_VARIABILITY' | 'INSUFFICIENT_HISTORY' | 'NO_CURRENT_DATA';

// ---- Request types ----

/** Metric name -> finite number or null. Keys follow `^[a-z][a-z0-9_]{0,63}$`. */
export type Measurements = Readonly<Record<string, number | null>>;

export interface HistoryRecord {
  readonly timestamp: string;
  readonly measurements: Measurements;
}

export interface AnalyzeRequest {
  readonly subject_id: string;
  readonly timestamp: string;
  readonly measurements: Measurements;
  readonly history: readonly HistoryRecord[];
}
