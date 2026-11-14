import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { createMockExtensionClient, type ExtensionClient } from '../cognitive/client';
import type { CognitiveRequest, EvidenceRequest } from '../cognitive/types';
import { FatigueView } from './FatigueView';

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.108 Safari/537.36';

/** Mock client with a spy on every request, so tests can check what each context sends. */
function spyClient() {
  const base = createMockExtensionClient();
  const evidence: EvidenceRequest[] = [];
  const cognitive: CognitiveRequest[] = [];
  const client: ExtensionClient = {
    source: 'mock',
    assessEvidence: vi.fn((request: EvidenceRequest, signal?: AbortSignal) => {
      evidence.push(request);
      return base.assessEvidence(request, signal);
    }),
    analyzeCognitive: vi.fn((request: CognitiveRequest, signal?: AbortSignal) => {
      cognitive.push(request);
      return base.analyzeCognitive(request, signal);
    }),
  };
  return { client, evidence, cognitive };
}

const memoryStorage = (): Storage => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage;
};

const section = (name: string) => screen.getByRole('heading', { name }).closest('section') as HTMLElement;
const synthetic = () => section('Synthetic mission reassessment');
const real = () => section('Real participant check');

describe('Fatigue evidence view', () => {
  test('says the responses come from the contract-based mock and that nothing is a diagnosis', () => {
    render(<FatigueView client={spyClient().client} userAgent={CHROME_MAC} storage={memoryStorage()} />);

    expect(screen.getByTestId('extension-source')).toHaveTextContent('contract-based mock');
    expect(screen.getByText(/Neither gives a diagnosis, a risk score or a fitness-for-duty decision/)).toBeInTheDocument();
  });

  test('synthetic reassessment: report, sleep check-in, synthetic reaction check, reassessment', async () => {
    const user = userEvent.setup();
    const spy = spyClient();
    render(<FatigueView client={spy.client} userAgent={CHROME_MAC} storage={memoryStorage()} />);

    await user.click(within(synthetic()).getByRole('button', { name: 'Synthetic crew member reports fatigue' }));
    const inventory = await within(synthetic()).findByTestId('evidence-result');
    expect(inventory).toHaveTextContent('Synthetic demonstration · mission clock');
    expect(inventory).toHaveTextContent('Some evidence is missing');
    expect(
      within(inventory).getByText('Heart rate alone cannot explain reported fatigue. This inventory is not a diagnosis.'),
    ).toBeInTheDocument();

    await user.click(within(synthetic()).getByRole('button', { name: 'Sleep check-in' }));
    await waitFor(() =>
      expect(spy.evidence.at(-1)?.observations.map((o) => o.kind)).toEqual(['heart_rate', 'sleep_duration']),
    );

    await user.click(within(synthetic()).getByRole('button', { name: 'Reaction-time check' }));
    const summary = await within(synthetic()).findByTestId('cognitive-result');
    expect(within(summary).getByTestId('cognitive-baseline')).toHaveTextContent('320 ms (+50 ms)');
    expect(summary).toHaveTextContent('Synthetic demonstration only.');
    await waitFor(() =>
      expect(within(synthetic()).getByTestId('evidence-result')).toHaveTextContent('Evidence inventory complete'),
    );

    const all = [...spy.evidence, ...spy.cognitive];
    expect(all.every((r) => r.mode === 'simulation' && r.clock.kind === 'mission' && r.subject_id === 'sim-crew-B')).toBe(true);
    expect(spy.evidence.flatMap((r) => r.observations.map((o) => o.source.kind)).every((k) => k === 'simulated')).toBe(true);
  });

  test('real participant: UTC evidence inventory with self-reported sleep, kept apart from synthetic data', async () => {
    const user = userEvent.setup();
    const spy = spyClient();
    render(<FatigueView client={spy.client} userAgent={CHROME_MAC} storage={memoryStorage()} />);

    await user.type(within(real()).getByLabelText(/Optional sleep check-in/), '6');
    await user.click(within(real()).getByRole('button', { name: 'I feel fatigued — show the evidence' }));
    const inventory = await within(real()).findByTestId('evidence-result');
    expect(inventory).toHaveTextContent('Real participant · UTC clock');
    expect(spy.evidence[0]).toMatchObject({
      subject_id: 'participant-01',
      mode: 'real_assessment',
      clock: { kind: 'utc', id: 'utc' },
    });
    expect(spy.evidence[0]?.observations).toEqual([
      expect.objectContaining({ kind: 'sleep_duration', value: 6, source: { kind: 'human_entered', source_id: null } }),
    ]);
    expect(within(real()).getByRole('button', { name: 'Start reaction-time check' })).toBeInTheDocument();
    expect(within(real()).getByText(/familiarization \(practice\)/)).toBeInTheDocument();

    await user.click(within(synthetic()).getByRole('button', { name: 'Synthetic crew member reports fatigue' }));
    await within(synthetic()).findByTestId('evidence-result');
    const syntheticRequest = spy.evidence.at(-1);
    expect(syntheticRequest?.subject_id).toBe('sim-crew-B');
    expect(syntheticRequest?.observations.some((o) => o.source.kind !== 'simulated')).toBe(false);
  });

  test('blocks the reaction check on unsupported setups and for non-opaque participant IDs', async () => {
    const user = userEvent.setup();
    const linux = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0.0.0 Safari/537.36';
    const { unmount } = render(<FatigueView client={spyClient().client} userAgent={linux} storage={memoryStorage()} />);
    expect(within(real()).getByText(/operating system version is not reported/)).toBeInTheDocument();
    expect(within(real()).queryByRole('button', { name: 'Start reaction-time check' })).toBeNull();
    unmount();

    render(<FatigueView client={spyClient().client} userAgent={CHROME_MAC} storage={memoryStorage()} />);
    const id = within(real()).getByLabelText(/Participant ID/);
    await user.clear(id);
    await user.type(id, 'p#1');
    expect(within(real()).getByText(/Enter an opaque participant ID/)).toBeInTheDocument();
    expect(within(real()).getByRole('button', { name: 'I feel fatigued — show the evidence' })).toBeDisabled();
  });
});
