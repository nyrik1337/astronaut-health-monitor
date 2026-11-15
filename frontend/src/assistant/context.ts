import type { Clock, CognitiveRequest, EvidenceRequest, Mode } from '../cognitive/types';
import type { AssistantRequest } from './types';

/**
 * The assessment context the AI Companion may explain: the RAW requests behind the evidence and
 * reaction-time results currently shown in one panel. Nothing here is invented — a missing
 * assessment is `null`, never a placeholder value.
 */
export interface AssistantContext {
  readonly subject_id: string;
  readonly mode: Mode;
  readonly clock: Clock;
  /** Mission instant for simulation; ignored for real mode, which uses the send time. */
  readonly as_of: string;
  readonly evidence: EvidenceRequest | null;
  readonly cognitive: CognitiveRequest | null;
}

export const contextKey = (c: AssistantContext): string => `${c.mode}|${c.clock.kind}:${c.clock.id}|${c.subject_id}`;

/**
 * Builds the chat request. All enclosing `as_of` values are aligned to one instant (the current UTC
 * time for a real participant, the mission instant for a simulation); observation and session
 * times inside are never changed.
 */
export function buildAssistantRequest(
  context: AssistantContext,
  question: string,
  nowMs: number,
  gentleBreathingAvailable: boolean,
): AssistantRequest {
  const asOf = context.mode === 'real_assessment' ? new Date(nowMs).toISOString() : context.as_of;
  return {
    subject_id: context.subject_id,
    mode: context.mode,
    clock: context.clock,
    as_of: asOf,
    question: question.trim(),
    evidence: context.evidence === null ? null : { ...context.evidence, as_of: asOf },
    cognitive: context.cognitive === null ? null : { ...context.cognitive, as_of: asOf },
    gentle_breathing_available: gentleBreathingAvailable,
  };
}
