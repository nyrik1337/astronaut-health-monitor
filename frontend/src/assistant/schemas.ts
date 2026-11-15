import { z } from 'zod';
import { clockSchema, cognitiveResponseSchema, evidenceResponseSchema, modeSchema } from '../cognitive/schemas';

/** Strict response schema for the DRAFT `assistant-1` contract (see ./types.ts). */
export const assistantResponseSchema = z.strictObject({
  subject_id: z.string(),
  mode: modeSchema,
  clock: clockSchema,
  as_of: z.string(),
  answer: z.string().min(1).max(8_000),
  model: z.string(),
  generation: z.literal('local_ollama'),
  provenance: z.enum(['client_asserted_real', 'synthetic_demonstration']),
  evidence: evidenceResponseSchema.nullable(),
  cognitive: cognitiveResponseSchema.nullable(),
  limitations: z.array(z.string()),
  disclaimer: z.string(),
  truncated: z.boolean(),
});
