import { z } from 'zod';

/**
 * Runtime schemas for the additive Evidence Navigator and CognitiveGuard routes in
 * docs/API_CONTRACT.md (extension revision `evidence-cognitive-1`). Responses are parsed strictly:
 * every field is required (nullable where the contract says so) and unknown fields are rejected,
 * so contract drift surfaces as an `invalid_response` error instead of silently rendering.
 */

export const modeSchema = z.enum(['simulation', 'real_assessment']);
export const provenanceSchema = z.enum([
  'simulated',
  'browser_measured',
  'real_device',
  'human_entered',
  'research_dataset',
]);
export const clockSchema = z.strictObject({ kind: z.enum(['mission', 'utc']), id: z.string() });
export const sourceSchema = z.strictObject({ kind: provenanceSchema, source_id: z.string().nullable() });
export const qualitySchema = z.strictObject({
  status: z.enum(['unknown', 'acceptable', 'poor']),
  reasons: z.array(z.string()),
});
export const noticeOutputSchema = z.strictObject({
  id: z.string(),
  reported_at: z.string(),
  source: sourceSchema,
  text: z.string(),
  verification: z.literal('unverified_client_input'),
});
export const nextCheckSchema = z.strictObject({
  code: z.enum(['sleep_check_in', 'reaction_time_check', 'collect_comparable_history', 'repeat_uninterrupted']),
  optional: z.literal(true),
});
export const policySchema = z.strictObject({
  version: z.literal('demo-1'),
  freshness_seconds: z.strictObject({
    heart_rate: z.literal(900),
    sleep_duration: z.literal(129600),
    cognitive_test: z.literal(86400),
  }),
  history_max_age_seconds: z.literal(2592000),
  familiarization_sessions: z.literal(2),
  minimum_baseline_sessions: z.literal(3),
  minimum_valid_trials: z.literal(16),
});

export const evidenceKindSchema = z.enum(['heart_rate', 'sleep_duration', 'cognitive_test']);
export const evidenceStatusSchema = z.enum(['available', 'missing_data', 'stale_data', 'poor_quality']);
export const evidenceItemSchema = z.strictObject({
  kind: evidenceKindSchema,
  status: evidenceStatusSchema,
  observed_at: z.string().nullable(),
  value: z.number().nullable(),
  source: sourceSchema.nullable(),
  quality: qualitySchema.nullable(),
  age_seconds: z.number().nullable(),
  issues: z.array(z.enum(['missing_data', 'stale_data', 'poor_quality', 'quality_unknown'])),
});

export const evidenceResponseSchema = z.strictObject({
  subject_id: z.string(),
  mode: modeSchema,
  clock: clockSchema,
  as_of: z.string(),
  interpretation: z.enum(['synthetic_demonstration', 'evidence_inventory']),
  policy: policySchema,
  assessment_status: z.enum(['complete', 'missing_data', 'stale_data', 'poor_quality', 'mixed']),
  evidence: z.array(evidenceItemSchema),
  what_data_show: z.array(z.string()),
  unknowns: z.array(z.string()),
  limitations: z.array(z.string()),
  next_checks: z.array(nextCheckSchema),
  notices: z.array(noticeOutputSchema),
});

export const summarySchema = z.strictObject({
  valid_trials: z.int(),
  missed_responses: z.int(),
  early_responses: z.int(),
  median_reaction_time_ms: z.number().nullable(),
  p90_reaction_time_ms: z.number().nullable(),
});

export const cognitiveResponseSchema = z.strictObject({
  subject_id: z.string(),
  mode: modeSchema,
  clock: clockSchema,
  as_of: z.string(),
  session_id: z.string(),
  timestamp: z.string(),
  test_version: z.literal('orbita-rt-1'),
  interpretation: z.enum(['synthetic_demonstration', 'experimental_personal_summary']),
  policy: policySchema,
  analysis_status: z.enum(['analyzed', 'insufficient_history', 'missing_data', 'poor_quality', 'stale_data']),
  issues: z.array(
    z.enum(['missing_data', 'stale_data', 'poor_quality', 'familiarization', 'insufficient_history']),
  ),
  current: summarySchema,
  baseline: z
    .strictObject({
      session_ids: z.array(z.string()),
      median_reaction_time_ms: z.number(),
      signed_difference_ms: z.number(),
    })
    .nullable(),
  history_evaluation: z.array(
    z.strictObject({
      session_id: z.string(),
      disposition: z.enum(['baseline', 'familiarization', 'excluded']),
      reasons: z.array(
        z.enum(['context_mismatch', 'poor_quality', 'history_expired', 'familiarization_incomplete']),
      ),
    }),
  ),
  context_observations: z.array(evidenceItemSchema),
  what_data_show: z.array(z.string()),
  limitations: z.array(z.string()),
  next_checks: z.array(nextCheckSchema),
  notices: z.array(noticeOutputSchema),
});
