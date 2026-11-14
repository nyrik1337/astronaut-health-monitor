import type { ApiClient } from '../api/client';
import type { AnalyzeRequest, AnalyzeResponse, HealthResponse } from '../api/types';

export const HEALTH_OK: HealthResponse = {
  status: 'ok',
  service: 'astronaut-health-monitor',
  version: '0.1.0',
};

export const DISCLAIMER =
  'This demonstration describes deviation from submitted personal history. Five readings do not establish clinical reliability, and the result is not a medical diagnosis.';

/** The contract's "Successful response example", re-targeted at a given request timestamp. */
export function partialResponse(timestamp: string): AnalyzeResponse {
  return {
    subject_id: 'demo-subject-01',
    timestamp,
    analysis_status: 'partial',
    baseline_method: 'median_mad',
    minimum_history_samples: 5,
    metrics: {
      heart_rate_bpm: {
        current: 74,
        status: 'analyzed',
        history_samples: 5,
        baseline: { median: 70, mad: 1, scaled_mad: 1.4826 },
        deviation: { absolute: 4, robust_z_score: 2.697 },
      },
      spo2_percent: {
        current: 98,
        status: 'zero_variability',
        history_samples: 5,
        baseline: { median: 98, mad: 0, scaled_mad: 0 },
        deviation: { absolute: 0, robust_z_score: null },
      },
      body_temperature_c: {
        current: 36.7,
        status: 'insufficient_history',
        history_samples: 4,
        baseline: null,
        deviation: null,
      },
    },
    warnings: [
      {
        code: 'ZERO_BASELINE_VARIABILITY',
        metric: 'spo2_percent',
        message: 'A standardized deviation cannot be calculated because the median absolute deviation is zero.',
      },
      {
        code: 'INSUFFICIENT_HISTORY',
        metric: 'body_temperature_c',
        message: 'At least 5 valid historical values are required for this demonstration; 4 were supplied.',
      },
    ],
    disclaimer: DISCLAIMER,
  };
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type AnalyzeImpl = (request: AnalyzeRequest, signal?: AbortSignal) => Promise<AnalyzeResponse>;
type HealthImpl = (signal?: AbortSignal) => Promise<HealthResponse>;

export function fakeClient(overrides: { analyze?: AnalyzeImpl; getHealth?: HealthImpl } = {}): ApiClient {
  return {
    baseUrl: 'http://backend.test',
    getHealth: overrides.getHealth ?? (() => Promise.resolve(HEALTH_OK)),
    analyze: overrides.analyze ?? ((request) => Promise.resolve(partialResponse(request.timestamp))),
  };
}
