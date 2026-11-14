import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createMockExtensionClient, type ExtensionClient } from '../cognitive/client';
import { REAL_STORE_KEY } from '../cognitive/realStore';
import type { CognitiveRequest, EvidenceRequest } from '../cognitive/types';
import { RealPanel } from './RealPanel';

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.108 Safari/537.36';

function memoryStorage(): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage & { map: Map<string, string> };
}

function spyClient() {
  const base = createMockExtensionClient();
  const cognitive: CognitiveRequest[] = [];
  const evidence: EvidenceRequest[] = [];
  const client: ExtensionClient = {
    source: 'mock',
    assessEvidence: (r, s) => {
      evidence.push(r);
      return base.assessEvidence(r, s);
    },
    analyzeCognitive: (r, s) => {
      cognitive.push(r);
      return base.analyzeCognitive(r, s);
    },
  };
  return { client, cognitive, evidence };
}

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Real participant panel', () => {
  test('a full 20-trial browser check is submitted, displayed and kept in memory only', async () => {
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'performance',
        'Date',
      ],
    });
    vi.spyOn(Math, 'random').mockReturnValue(0); // every wait is 1000 ms
    const storage = memoryStorage();
    const spy = spyClient();
    const { container } = render(<RealPanel client={spy.client} userAgent={CHROME_MAC} storage={storage} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start reaction-time check' }));
    for (let trial = 0; trial < 20; trial++) {
      for (let guard = 0; guard < 300 && !container.querySelector('.reaction-check__target'); guard++) advance(16);
      advance(304);
      fireEvent.keyDown(window, { code: 'Space', repeat: false });
      fireEvent.keyDown(window, { code: 'Space', repeat: true }); // key repeat is ignored
      fireEvent.keyUp(window, { code: 'Space' });
    }
    vi.useRealTimers();

    const result = await screen.findByTestId('cognitive-result');
    const sent = spy.cognitive[0];
    expect(sent?.mode).toBe('real_assessment');
    expect(sent?.current_test).toMatchObject({
      completion: 'completed',
      interruptions: [],
      phase: 'familiarization',
      source: { kind: 'browser_measured', source_id: null },
      test_version: 'orbita-rt-1',
    });
    expect(sent?.current_test.trials).toHaveLength(20);
    expect(sent?.current_test.trials.every((t) => t.outcome === 'response' && t.wait_ms === 1000)).toBe(true);
    expect(sent?.history).toEqual([]);
    expect(within(result).getByText('Not enough comparable history yet')).toBeInTheDocument();
    expect(within(result).getByText('Personal baseline (your earlier checks)')).toBeInTheDocument();
    expect(await screen.findByText(/1 stored session/)).toBeInTheDocument();
    expect(storage.map.has(REAL_STORE_KEY)).toBe(false);
  });

  test('stores results only after opt-in, and Clear removes them', () => {
    const storage = memoryStorage();
    render(<RealPanel client={spyClient().client} userAgent={CHROME_MAC} storage={storage} />);
    const keep = screen.getByRole('checkbox', { name: /Keep my real-participant results/ });
    expect(keep).not.toBeChecked();
    expect(storage.map.size).toBe(0);

    fireEvent.click(keep);
    expect(storage.map.has(REAL_STORE_KEY)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Clear real participant data' }));
    expect(storage.map.has(REAL_STORE_KEY)).toBe(false);
    expect(keep).not.toBeChecked();
  });
});
