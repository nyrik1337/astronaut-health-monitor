import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { MissionView } from './MissionView';

const day = (): string => screen.getByTestId('mission-day').textContent ?? '';
const seek = (to: number): void => {
  fireEvent.change(screen.getByLabelText('Mission day'), { target: { value: String(to) } });
};
const notifications = () => screen.queryByRole('list', { name: 'Notifications, newest first' });
const detections = () => screen.getByRole('list', { name: 'Initial detections, newest first' });

afterEach(() => {
  vi.useRealTimers();
});

describe('Mission simulation view', () => {
  test('is clearly labelled as a synthetic replay and starts in the baseline period', () => {
    render(<MissionView />);

    expect(screen.getByRole('heading', { name: 'Mission simulation' })).toBeInTheDocument();
    expect(screen.getByText('Synthetic replay')).toBeInTheDocument();
    expect(screen.getByText(/not clinically validated and not a diagnosis/)).toBeInTheDocument();
    expect(screen.getByText(/does not send data to the backend/)).toBeInTheDocument();
    expect(day()).toBe('1');
    expect(screen.getByText(/Baseline building: day 1 of 30/)).toBeInTheDocument();
    const cells = screen.getAllByRole('button', { name: /Show measurement details/ });
    expect(cells).toHaveLength(24);
    expect(cells.every((cell) => cell.getAttribute('data-state') === 'baseline_building')).toBe(true);
    expect(screen.getByText('No notifications yet.')).toBeInTheDocument();
  });

  test('play advances the days, pause stops them, reset returns to day 1', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    render(<MissionView />);

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    act(() => vi.advanceTimersByTime(1000));
    expect(day()).toBe('5');

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => vi.advanceTimersByTime(3000));
    expect(day()).toBe('5');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(day()).toBe('1');
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  test('16× plays the whole mission and stops on day 500', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    render(<MissionView />);

    fireEvent.change(screen.getByLabelText('Playback speed'), { target: { value: '16' } });
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    act(() => vi.advanceTimersByTime(8000));

    expect(day()).toBe('500');
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(Number(screen.getByTestId('count-notifications').textContent)).toBeGreaterThan(5);
  });

  test('shows the initial detection first and the sustained-trend notification after the hold', () => {
    render(<MissionView />);

    seek(65);
    const pending = within(detections()).getByText('Pending: grouping check until day 67');
    expect(pending.closest('li')).toHaveTextContent('Day 64 · Crew member B · Sleep');
    expect(pending.closest('li')).toHaveTextContent('Sustained-trend detector fired');
    expect(notifications()).toBeNull();
    expect(screen.getByText('Waiting to be notified')).toBeInTheDocument();
    expect(screen.getByText('Detected on day 64; grouping check until day 67.')).toBeInTheDocument();

    seek(67);
    const list = notifications();
    expect(list).not.toBeNull();
    const item = within(list as HTMLElement).getByText(/sustained deviation/i, { selector: '.event__title' });
    expect(item.closest('li')).toHaveTextContent('Detected on day 64; held 3 days for a grouping check.');
    expect(item.closest('li')).toHaveTextContent('Sustained deviation · Day 67');
    expect(within(detections()).getByText('Notified on day 67')).toBeInTheDocument();
    expect(screen.getByTestId('mission-announcement')).toHaveTextContent('Day 67: new notification.');
  });

  test('groups simultaneous signals and covers detections during the particle event', () => {
    render(<MissionView />);

    seek(127);
    expect(within(notifications() as HTMLElement).getByText('Sleep: multiple signals')).toBeInTheDocument();
    expect(within(detections()).getAllByText('Grouped into one multiple-signals item')).toHaveLength(3);

    seek(301);
    expect(screen.getByText(/Simulated particle event in progress/)).toBeInTheDocument();
    expect(within(detections()).getAllByText('Covered by the simulated particle event')).toHaveLength(4);
    const environment = screen.getByRole('heading', { name: 'Simulated environment' }).closest('section');
    expect(within(environment as HTMLElement).getByText(/not a validated action threshold/)).toBeInTheDocument();
    expect(within(notifications() as HTMLElement).getByText('Simulated particle event')).toBeInTheDocument();
  });

  test('shows measurement details for a selected cell without future data', async () => {
    const user = userEvent.setup();
    render(<MissionView />);

    seek(10);
    await user.click(screen.getByRole('button', { name: /Crew member B, Sleep: Baseline building/ }));
    expect(screen.getByRole('heading', { name: 'Measurement details: Crew member B · Sleep' })).toBeInTheDocument();
    expect(screen.getByText(/10 of 30 days collected/)).toBeInTheDocument();
    expect(screen.getByText('not available yet')).toBeInTheDocument();

    seek(70);
    const details = screen.getByRole('heading', { name: /Measurement details/ }).closest('section') as HTMLElement;
    expect(within(details).queryByText('not available yet')).toBeNull();
    expect(within(details).getByRole('img', { name: /from day 1 to day 70/ })).toBeInTheDocument();
    expect(within(details).getByText('Show the last 7 days as a table')).toBeInTheDocument();
    expect(within(details).getByText(/below the personal baseline/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crew member B, Sleep:/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('scripted event buttons jump to their day', async () => {
    const user = userEvent.setup();
    render(<MissionView />);

    await user.click(screen.getByRole('button', { name: /Day 380: Sleep dip and return to range/ }));
    expect(day()).toBe('380');
    expect(screen.getByRole('button', { name: /Day 210: Single heart-rate spike/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
