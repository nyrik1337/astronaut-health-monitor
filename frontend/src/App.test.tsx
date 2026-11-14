import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { App } from './App';
import { ApiError } from './api/errors';
import type { AnalyzeRequest, AnalyzeResponse } from './api/types';
import { DISCLAIMER, fakeClient, partialResponse } from './test/fixtures';

const networkError = () =>
  new ApiError({ kind: 'network', status: null, code: 'NETWORK_ERROR', message: 'Could not reach the backend.' });

function metricArticle(name: string): HTMLElement {
  return screen.getByRole('article', { name });
}

describe('App dashboard', () => {
  test('labels the data as synthetic and reports the backend as online', async () => {
    render(<App client={fakeClient()} />);

    expect(screen.getByText('Synthetic demo data')).toBeInTheDocument();
    expect(await screen.findByText(/Backend online · astronaut-health-monitor 0\.1\.0/)).toBeInTheDocument();
  });

  test('renders the contract response: overall status, metric statuses, baseline and warnings', async () => {
    render(<App client={fakeClient()} />);

    expect(await screen.findByText('Partial')).toBeInTheDocument();

    const heartRate = metricArticle('Heart rate');
    expect(within(heartRate).getByText('Analyzed')).toBeInTheDocument();
    expect(within(heartRate).getByText('70 bpm')).toBeInTheDocument();
    expect(within(heartRate).getByText('+4 bpm')).toBeInTheDocument();
    expect(within(heartRate).getByText('+2.70')).toBeInTheDocument();

    const spo2 = metricArticle('SpO₂');
    expect(within(spo2).getByText('Zero variability')).toBeInTheDocument();
    expect(within(spo2).getByText('Not available')).toBeInTheDocument();

    const temperature = metricArticle('Body temperature');
    expect(within(temperature).getByText('Insufficient history')).toBeInTheDocument();
    expect(within(temperature).queryByText('Personal median')).not.toBeInTheDocument();

    const warnings = screen.getByRole('region', { name: /Analysis warnings/ });
    expect(within(warnings).getByText('ZERO_BASELINE_VARIABILITY')).toBeInTheDocument();
    expect(within(warnings).getByText(/4 were supplied/)).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
  });

  test('shows a missing-data gap note and a table alternative for each chart', async () => {
    render(<App client={fakeClient()} />);
    await screen.findByText('Partial');

    const temperature = metricArticle('Body temperature');
    expect(within(temperature).getByText(/1 of 24 readings have no Body temperature value/)).toBeInTheDocument();
    expect(within(temperature).getByText('Show Body temperature readings as a table')).toBeInTheDocument();
    expect(within(temperature).getAllByText('Missing').length).toBeGreaterThan(0);
  });

  test('shows a loading state until the analysis resolves', async () => {
    let resolve: (value: AnalyzeResponse) => void = () => {};
    const analyze = vi.fn((request: AnalyzeRequest) => {
      void request;
      return new Promise<AnalyzeResponse>((r) => {
        resolve = r;
      });
    });
    render(<App client={fakeClient({ analyze })} />);

    expect(await screen.findByText('Analyzing the latest reading…')).toBeInTheDocument();
    expect(within(metricArticle('Heart rate')).getByText('Analyzing…')).toBeInTheDocument();

    const request = analyze.mock.calls.at(-1)?.[0];
    resolve(partialResponse(request?.timestamp ?? ''));
    expect(await screen.findByText('Partial')).toBeInTheDocument();
  });

  test('shows an alert with retry when the backend is unreachable, and still charts local readings', async () => {
    const analyze = vi.fn().mockRejectedValueOnce(networkError()).mockImplementation((request: AnalyzeRequest) =>
      Promise.resolve(partialResponse(request.timestamp)),
    );
    const client = fakeClient({ analyze, getHealth: () => Promise.reject(networkError()) });
    render(<App client={client} />);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Backend unreachable')).toBeInTheDocument();
    expect(within(metricArticle('Heart rate')).getByText(/Analysis failed/)).toBeInTheDocument();
    expect(within(metricArticle('Heart rate')).getByText('bpm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();

    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Partial')).toBeInTheDocument();
    expect(analyze).toHaveBeenCalledTimes(2);
  });

  test('lists contract validation details from a 422 response', async () => {
    const error = new ApiError({
      kind: 'http',
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      details: [{ field: 'history.2.timestamp', code: 'DUPLICATE_TIMESTAMP', message: 'Historical timestamps must be unique.' }],
    });
    render(<App client={fakeClient({ analyze: () => Promise.reject(error) })} />);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Request rejected by validation')).toBeInTheDocument();
    expect(within(alert).getByText('history.2.timestamp')).toBeInTheDocument();
    expect(within(alert).getByText('VALIDATION_ERROR · HTTP 422')).toBeInTheDocument();
  });

  test('adding a reading re-submits the previous current reading as history', async () => {
    const analyze = vi.fn((request: AnalyzeRequest) => Promise.resolve(partialResponse(request.timestamp)));
    render(<App client={fakeClient({ analyze })} />);
    await screen.findByText('Partial');

    await userEvent.click(screen.getByRole('button', { name: 'Add reading without SpO₂' }));

    await waitFor(() => expect(analyze.mock.calls.at(-1)?.[0].history).toHaveLength(24));
    expect(analyze.mock.calls.at(-1)?.[0].measurements.spo2_percent).toBeNull();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  test('reset restores the selected scenario snapshot, clears stale analysis and re-analyzes it', async () => {
    const analyze = vi.fn((request: AnalyzeRequest) => Promise.resolve(partialResponse(request.timestamp)));
    render(<App client={fakeClient({ analyze })} />);
    await screen.findByText('Partial');

    await userEvent.selectOptions(screen.getByLabelText('Scenario'), 'short_history');

    await waitFor(() => expect(analyze.mock.calls.at(-1)?.[0].history).toHaveLength(3));
    expect(screen.getByText(/only 3 history values exist/)).toBeInTheDocument();
    const selectedScenarioRequest = analyze.mock.calls.at(-1)?.[0];

    await userEvent.click(screen.getByRole('button', { name: 'Add reading' }));
    await waitFor(() => expect(analyze.mock.calls.at(-1)?.[0].history).toHaveLength(4));

    let resolveReset: (value: AnalyzeResponse) => void = () => {};
    analyze.mockImplementationOnce((request) => new Promise((resolve) => {
      resolveReset = resolve;
      void request;
    }));
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 31 * 60_000);
    fireEvent.click(screen.getByRole('button', { name: 'Reset scenario' }));
    vi.useRealTimers();

    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(4));
    const resetRequest = analyze.mock.calls.at(-1)?.[0];
    expect(resetRequest).toEqual(selectedScenarioRequest);
    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveValue('short_history');
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Analyzing the latest reading…')).toBeInTheDocument();
    expect(screen.queryByText('Partial')).not.toBeInTheDocument();

    resolveReset(partialResponse(resetRequest?.timestamp ?? ''));
    expect(await screen.findByText('Partial')).toBeInTheDocument();
  });

  test('shows "No current value" when the current reading has no value for a metric', async () => {
    render(<App client={fakeClient()} />);
    await screen.findByText('Partial');

    await userEvent.selectOptions(screen.getByLabelText('Scenario'), 'no_current_data');

    expect(within(metricArticle('Heart rate')).getAllByText('No current value').length).toBeGreaterThan(0);
  });
});
