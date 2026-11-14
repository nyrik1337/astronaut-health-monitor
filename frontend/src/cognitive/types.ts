import type { z } from 'zod';
import type {
  clockSchema,
  cognitiveResponseSchema,
  evidenceItemSchema,
  evidenceKindSchema,
  evidenceResponseSchema,
  modeSchema,
  nextCheckSchema,
  noticeOutputSchema,
  policySchema,
  provenanceSchema,
  qualitySchema,
  sourceSchema,
  summarySchema,
} from './schemas';

/** Types for the `evidence-cognitive-1` extension of docs/API_CONTRACT.md. */

// ---- Shared (inferred from the response schemas) ----
export type Mode = z.infer<typeof modeSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type Clock = z.infer<typeof clockSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Quality = z.infer<typeof qualitySchema>;
export type NoticeOutput = z.infer<typeof noticeOutputSchema>;
export type NextCheck = z.infer<typeof nextCheckSchema>;
export type Policy = z.infer<typeof policySchema>;
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export type EvidenceResponse = z.infer<typeof evidenceResponseSchema>;
export type Summary = z.infer<typeof summarySchema>;
export type CognitiveResponse = z.infer<typeof cognitiveResponseSchema>;

// ---- Requests ----
export interface NoticeInput {
  readonly id: string;
  readonly reported_at: string;
  readonly source: Source;
  readonly text: string;
}

export interface Observation {
  readonly kind: EvidenceKind;
  readonly observed_at: string;
  readonly value: number | null;
  readonly source: Source;
  readonly quality: Quality;
}

export interface EvidenceRequest {
  readonly subject_id: string;
  readonly mode: Mode;
  readonly clock: Clock;
  readonly as_of: string;
  readonly reported_issue: { readonly code: 'fatigue'; readonly reported_at: string; readonly source: Source };
  readonly observations: readonly Observation[];
  readonly notices: readonly NoticeInput[];
}

export type TrialOutcome = 'response' | 'early' | 'missed';

export interface Trial {
  readonly index: number;
  readonly wait_ms: number;
  readonly outcome: TrialOutcome;
  readonly reaction_time_ms: number | null;
}

export type Interruption = 'visibility_lost' | 'window_blur' | 'cancelled' | 'held_key' | 'scheduler_gap';
export type BrowserFamily = 'chrome' | 'edge' | 'firefox' | 'safari';
export type OsFamily = 'windows' | 'macos' | 'linux';

export interface SessionContext {
  readonly setup_id: string;
  readonly device_class: 'desktop' | 'laptop';
  readonly browser_family: BrowserFamily;
  readonly browser_version: string;
  readonly os_family: OsFamily;
  readonly os_version: string;
  readonly input_method: 'keyboard_space';
  readonly timing_api: 'performance_now';
}

export interface Session {
  readonly session_id: string;
  readonly subject_id: string;
  readonly clock: Clock;
  readonly test_version: 'orbita-rt-1';
  readonly phase: 'familiarization' | 'measurement';
  readonly started_at: string;
  readonly ended_at: string;
  readonly source: Source;
  readonly context: SessionContext;
  readonly completion: 'completed' | 'aborted';
  readonly interruptions: readonly Interruption[];
  readonly trials: readonly Trial[];
}

export interface CognitiveRequest {
  readonly subject_id: string;
  readonly mode: Mode;
  readonly clock: Clock;
  readonly as_of: string;
  readonly current_test: Session;
  readonly history: readonly Session[];
  readonly context_observations: readonly Observation[];
  readonly notices: readonly NoticeInput[];
}

/** The `demo-1` policy exactly as published in the contract (responses echo it). */
export const DEMO_POLICY: Policy = {
  version: 'demo-1',
  freshness_seconds: { heart_rate: 900, sleep_duration: 129600, cognitive_test: 86400 },
  history_max_age_seconds: 2592000,
  familiarization_sessions: 2,
  minimum_baseline_sessions: 3,
  minimum_valid_trials: 16,
};

export const UTC_CLOCK: Clock = { kind: 'utc', id: 'utc' };
