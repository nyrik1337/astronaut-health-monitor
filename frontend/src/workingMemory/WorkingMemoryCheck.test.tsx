import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMockExtensionClient, type ExtensionClient } from '../cognitive/client';
import { FatigueView } from '../fatigueView/FatigueView';
import { TRIAL_MS, isMatch, startRun } from './oneBack';
import { seeded } from './testRng';
import { WorkingMemoryCheck } from './WorkingMemoryCheck';

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

/** Plays a run symbol by symbol; `press(i)` decides whether Space is pressed on symbol i. */
function play(length: number, press: (i: number) => boolean): void {
  for (let i = 0; i < length; i++) {
    advance(100);
    if (press(i)) fireEvent.keyDown(window, { code: 'Space', repeat: false });
    advance(TRIAL_MS - 100);
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('Working Memory (experimental) 1-back', () => {
  test('practice then a scored run with one miss and one false alarm gives the explained score', () => {
    const expectedPractice = startRun('practice', seeded(42)).sequence;
    render(<WorkingMemoryCheck rng={seeded(42)} />);
    expect(screen.getByText('Experimental — not clinically validated')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start practice' }));
    expect(screen.getByTestId('working-memory-progress')).toHaveTextContent('warm-up, not scored');
    play(expectedPractice.length, (i) => isMatch(expectedPractice, i));
    expect(screen.getByTestId('working-memory-practice')).toHaveTextContent('Practice finished: 6 of 6 correct');

    fireEvent.click(screen.getByRole('button', { name: 'Start scored run' }));
    // The component's generator continues after the practice draw; replay the same draws here.
    const replay = seeded(42);
    startRun('practice', replay);
    const sequence = startRun('scored', replay).sequence;
    const matches = sequence.map((_, i) => i).filter((i) => isMatch(sequence, i));
    const firstNonMatch = sequence.findIndex((_, i) => i > 0 && !isMatch(sequence, i));
    play(sequence.length, (i) => (i === matches[0] ? false : i === firstNonMatch ? true : isMatch(sequence, i)));

    const result = screen.getByTestId('working-memory-result');
    expect(result).toHaveTextContent('Run complete: 18 of 20 correct (90% response accuracy)');
    expect(within(result).getByText('Hits (match, pressed)').nextSibling).toHaveTextContent('5');
    expect(within(result).getByText('Misses (match, not pressed)').nextSibling).toHaveTextContent('1');
    expect(within(result).getByText('False alarms (no match, pressed)').nextSibling).toHaveTextContent('1');
    expect(result).toHaveTextContent('number correct = hits + correct rejections = 5 + 13 = 18');
    expect(localStorage.length).toBe(0);
  });

  test('Match button works, key repeat is ignored, and Stop ends the run without a score', () => {
    render(<WorkingMemoryCheck rng={seeded(3)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start scored run' }));
    advance(TRIAL_MS);
    fireEvent.click(screen.getByRole('button', { name: 'Match (Space)' }));
    expect(screen.getByRole('button', { name: 'Match recorded' })).toHaveAttribute('aria-pressed', 'true');
    advance(TRIAL_MS);
    fireEvent.keyDown(window, { code: 'Space', repeat: true });
    expect(screen.getByRole('button', { name: 'Match (Space)' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(screen.getByRole('status')).toHaveTextContent('Stopped. No score is shown');
    expect(screen.queryByTestId('working-memory-result')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('losing tab or window focus invalidates the run and shows no score', () => {
    render(<WorkingMemoryCheck rng={seeded(5)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start scored run' }));
    advance(TRIAL_MS * 3);
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(screen.getByRole('status')).toHaveTextContent('Run invalidated because this tab or window lost focus');
    advance(TRIAL_MS * 30);
    expect(screen.queryByTestId('working-memory-result')).toBeNull();
  });

  test('lives inside the Fatigue evidence view and never calls the reaction-time or evidence APIs', () => {
    const base = createMockExtensionClient();
    const client: ExtensionClient = {
      source: 'mock',
      assessEvidence: vi.fn(base.assessEvidence),
      analyzeCognitive: vi.fn(base.analyzeCognitive),
    };
    render(<FatigueView client={client} storage={null} />);
    expect(screen.getByRole('heading', { name: 'Working Memory (experimental)' })).toBeInTheDocument();
    const panel = screen.getByTestId('working-memory');
    fireEvent.click(within(panel).getByRole('button', { name: 'Start scored run' }));
    play(21, () => false);
    expect(within(panel).getByTestId('working-memory-result')).toHaveTextContent('14 of 20 correct');
    expect(client.assessEvidence).not.toHaveBeenCalled();
    expect(client.analyzeCognitive).not.toHaveBeenCalled();
  });
});
