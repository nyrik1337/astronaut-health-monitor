import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { RecoveryView } from './RecoveryView';

const afterGroup = () => within(screen.getByRole('group', { name: 'How stressed do you feel now?' }));

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('MindGuard recovery loop', () => {
  test('before/after self-reports around a completed 60 s practice, with no causal claim and nothing stored', () => {
    render(<RecoveryView />);
    fireEvent.click(within(screen.getByRole('group', { name: 'How stressed do you feel right now?' })).getByRole('radio', { name: /4 High/ }));
    expect(screen.queryByText('3. Check in again (optional)')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Start breathing practice' }));
    expect(screen.getByTestId('breathing-prompt')).toHaveTextContent('Breathe in gently');
    advance(5_000);
    expect(screen.getByTestId('breathing-prompt')).toHaveTextContent('Breathe out slowly');

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByTestId('breathing-prompt')).toHaveTextContent('Paused');
    const pausedAt = screen.getByTestId('breathing-remaining').textContent;
    advance(20_000);
    expect(screen.getByTestId('breathing-remaining').textContent).toBe(pausedAt);

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    advance(56_000);
    expect(screen.getByTestId('breathing-prompt')).toHaveTextContent('Practice finished');

    fireEvent.click(afterGroup().getByRole('radio', { name: /2 Low/ }));
    const comparison = screen.getByTestId('stress-comparison');
    expect(comparison).toHaveTextContent('4 / 5 (High)');
    expect(comparison).toHaveTextContent('2 / 5 (Low)');
    expect(comparison).toHaveTextContent('does not show that the breathing practice caused the change');
    expect(localStorage.length).toBe(0);
  });

  test('stop ends the practice early, the after check-in stays optional, and Clear resets everything', () => {
    render(<RecoveryView />);
    fireEvent.click(screen.getByRole('button', { name: 'Start breathing practice' }));
    advance(10_000);
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(screen.getByTestId('breathing-prompt')).toHaveTextContent('Practice stopped');
    expect(screen.getByText('3. Check in again (optional)')).toBeInTheDocument();
    fireEvent.click(afterGroup().getByRole('radio', { name: /3 Moderate/ }));
    expect(screen.queryByTestId('stress-comparison')).toBeNull(); // no "before" answer was given

    fireEvent.click(screen.getByRole('button', { name: 'Clear my check-ins' }));
    expect(screen.queryByText('3. Check in again (optional)')).toBeNull();
    expect(screen.getByRole('button', { name: 'Start breathing practice' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').every((r) => !(r as HTMLInputElement).checked)).toBe(true);
  });

  test('explains follow-up outcomes without claiming the practice caused them', () => {
    render(<RecoveryView />);
    expect(screen.getByText('Returned to range')).toBeInTheDocument();
    expect(screen.getByText('Flagged for human review')).toBeInTheDocument();
    expect(screen.getByText(/does not prove that a break, a breathing practice/)).toBeInTheDocument();
    expect(screen.queryByText(/hold your breath for|hyperventilat|hypoxi/i)).toBeNull();
  });
});
