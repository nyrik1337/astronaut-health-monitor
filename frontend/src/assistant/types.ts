import type { z } from 'zod';
import type { Clock, CognitiveRequest, EvidenceRequest, Mode } from '../cognitive/types';
import type { assistantResponseSchema } from './schemas';

/**
 * AI Companion request, following Codex's DRAFT contract `assistant-1` (docs/API_CONTRACT.md on
 * branch feature/local-ai-companion, commit ef72e6f — "human PR review pending"). Re-check every
 * field against the approved contract commit before relying on it.
 */
export interface AssistantRequest {
  readonly subject_id: string;
  readonly mode: Mode;
  readonly clock: Clock;
  readonly as_of: string;
  readonly question: string;
  readonly evidence: EvidenceRequest | null;
  readonly cognitive: CognitiveRequest | null;
  readonly gentle_breathing_available: boolean;
}

export type AssistantResponse = z.infer<typeof assistantResponseSchema>;

/** Contract limit on `question` (1–2,000 characters, nonblank). */
export const MAX_QUESTION_LENGTH = 2_000;
