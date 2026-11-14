import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { App } from './App';
import type { AnalyzeRequest } from './api/types';
import { fakeClient, partialResponse } from './test/fixtures';

const LAZY_TIMEOUT = { timeout: 5000 };

describe('App views', () => {
  test('opens on the dashboard and does not load the mission view until asked', async () => {
    render(<App client={fakeClient()} />);

    expect(screen.getByRole('tab', { name: 'Vital signs dashboard' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /Mission simulation/ })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(await screen.findByText('Partial')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Mission simulation' })).toBeNull();
    expect(screen.getByText('Skip to dashboard')).toHaveAttribute('href', '#main');
    for (const tab of screen.getAllByRole('tab')) {
      const controlled = tab.getAttribute('aria-controls') ?? '';
      expect(document.getElementById(controlled)).not.toBeNull();
    }
  });

  test('switches to the mission simulation without calling the backend, and back with state kept', async () => {
    const user = userEvent.setup();
    const analyze = vi.fn((request: AnalyzeRequest) =>
      Promise.resolve(partialResponse(request.timestamp)),
    );
    render(<App client={fakeClient({ analyze })} />);
    await screen.findByText('Partial');
    const callsBefore = analyze.mock.calls.length;

    await user.click(screen.getByRole('tab', { name: /Mission simulation/ }));
    expect(
      await screen.findByRole('heading', { name: 'Mission simulation' }, LAZY_TIMEOUT),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Vital signs compared with personal history' }),
    ).toBeNull();
    expect(screen.getByText('Skip to mission simulation')).toHaveAttribute('href', '#mission');

    fireEvent.change(screen.getByLabelText('Mission day'), { target: { value: '120' } });
    expect(screen.getByTestId('mission-day')).toHaveTextContent('120');
    expect(analyze).toHaveBeenCalledTimes(callsBefore);

    await user.click(screen.getByRole('tab', { name: 'Vital signs dashboard' }));
    expect(
      screen.getByRole('heading', { name: 'Vital signs compared with personal history' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Partial')).toBeInTheDocument();
    expect(analyze).toHaveBeenCalledTimes(callsBefore);

    await user.click(screen.getByRole('tab', { name: /Mission simulation/ }));
    expect(screen.getByTestId('mission-day')).toHaveTextContent('120');
  });

  test('tabs follow the keyboard pattern: arrows, Home and End move and select', async () => {
    const user = userEvent.setup();
    render(<App client={fakeClient()} />);
    const dashboardTab = screen.getByRole('tab', { name: 'Vital signs dashboard' });

    dashboardTab.focus();
    await user.keyboard('{ArrowRight}');
    const missionTab = screen.getByRole('tab', { name: /Mission simulation/ });
    expect(missionTab).toHaveFocus();
    expect(missionTab).toHaveAttribute('aria-selected', 'true');
    expect(
      await screen.findByRole('heading', { name: 'Mission simulation' }, LAZY_TIMEOUT),
    ).toBeInTheDocument();

    await user.keyboard('{Home}');
    expect(dashboardTab).toHaveFocus();
    expect(dashboardTab).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{End}');
    expect(missionTab).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: /Mission simulation/ })).toBeInTheDocument();
  });
});
