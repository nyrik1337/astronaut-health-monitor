import type { CognitiveResponse, EvidenceItem, EvidenceKind, EvidenceResponse, Mode, NextCheck, Provenance } from '../cognitive/types';

/** Display text for Evidence Navigator and CognitiveGuard. Descriptive only — no diagnosis. */

export const MODE_LABEL: Record<Mode, string> = {
  simulation: 'Synthetic demonstration · mission clock',
  real_assessment: 'Real participant · UTC clock',
};

export const KIND_LABEL: Record<EvidenceKind, string> = {
  heart_rate: 'Heart rate',
  sleep_duration: 'Sleep (preceding 24 h)',
  cognitive_test: 'Reaction-time check',
};

export const KIND_UNIT: Record<EvidenceKind, string> = { heart_rate: 'bpm', sleep_duration: 'h', cognitive_test: 'ms' };

export const EVIDENCE_STATUS_LABEL: Record<EvidenceItem['status'], string> = {
  available: 'Available',
  missing_data: 'Missing',
  stale_data: 'Stale',
  poor_quality: 'Poor quality',
};

export const ISSUE_LABEL: Record<EvidenceItem['issues'][number], string> = {
  missing_data: 'missing',
  stale_data: 'stale',
  poor_quality: 'poor quality',
  quality_unknown: 'quality unknown',
};

export const ASSESSMENT_LABEL: Record<EvidenceResponse['assessment_status'], string> = {
  complete: 'Evidence inventory complete',
  missing_data: 'Some evidence is missing',
  stale_data: 'Some evidence is stale',
  poor_quality: 'Some evidence is poor quality',
  mixed: 'Evidence is missing, stale or poor in more than one way',
};

export const NEXT_CHECK_LABEL: Record<NextCheck['code'], string> = {
  sleep_check_in: 'Sleep check-in',
  reaction_time_check: 'Reaction-time check',
  collect_comparable_history: 'Collect comparable history',
  repeat_uninterrupted: 'Repeat without interruption',
};

export const ANALYSIS_LABEL: Record<CognitiveResponse['analysis_status'], string> = {
  analyzed: 'Compared with the personal baseline',
  insufficient_history: 'Not enough comparable history yet',
  missing_data: 'No valid responses',
  poor_quality: 'Session quality too low to compare',
  stale_data: 'Result is older than 24 hours',
};

export const DISPOSITION_LABEL: Record<CognitiveResponse['history_evaluation'][number]['disposition'], string> = {
  baseline: 'Baseline',
  familiarization: 'Familiarization',
  excluded: 'Excluded',
};

export const REASON_LABEL: Record<CognitiveResponse['history_evaluation'][number]['reasons'][number], string> = {
  context_mismatch: 'different setup',
  poor_quality: 'poor quality',
  history_expired: 'older than 30 days',
  familiarization_incomplete: 'familiarization incomplete',
};

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  simulated: 'Synthetic',
  browser_measured: 'Browser-measured',
  real_device: 'Device',
  human_entered: 'Self-reported',
  research_dataset: 'Research dataset',
};

export function formatAge(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 120) return `${Math.round(seconds)} s`;
  if (seconds < 7200) return `${Math.round(seconds / 60)} min`;
  if (seconds < 172800) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} d`;
}

export const formatMs = (value: number | null): string => (value === null ? '—' : `${value} ms`);

export const formatSignedMs = (value: number): string =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)} ms`;
