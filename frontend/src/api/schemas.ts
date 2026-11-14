import { z } from 'zod';

/**
 * Runtime schemas for every response shape in docs/API_CONTRACT.md (API version 0.1.0).
 * TypeScript types are inferred from these so the compile-time and runtime views cannot drift.
 */

export const metricStatusSchema = z.enum([
  'analyzed',
  'zero_variability',
  'insufficient_history',
  'missing_current',
]);

export const analysisStatusSchema = z.enum([
  'complete',
  'partial',
  'insufficient_history',
  'no_current_data',
]);

export const baselineSchema = z.object({
  median: z.number(),
  mad: z.number(),
  scaled_mad: z.number(),
});

export const deviationSchema = z.object({
  absolute: z.number(),
  robust_z_score: z.number().nullable(),
});

export const metricResultSchema = z.object({
  current: z.number().nullable(),
  status: metricStatusSchema,
  history_samples: z.number().int().nonnegative(),
  baseline: baselineSchema.nullable(),
  deviation: deviationSchema.nullable(),
});

export const analysisWarningSchema = z.object({
  // Codes are kept open-ended so a new backend code renders instead of failing validation.
  code: z.string(),
  metric: z.string().nullable(),
  message: z.string(),
});

export const analyzeResponseSchema = z.object({
  subject_id: z.string(),
  timestamp: z.string(),
  analysis_status: analysisStatusSchema,
  baseline_method: z.string(),
  minimum_history_samples: z.number().int().nonnegative(),
  metrics: z.record(z.string(), metricResultSchema),
  warnings: z.array(analysisWarningSchema),
  disclaimer: z.string(),
});

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  version: z.string(),
});

export const validationDetailSchema = z.object({
  field: z.string(),
  code: z.string(),
  message: z.string(),
});

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(validationDetailSchema),
  }),
});
