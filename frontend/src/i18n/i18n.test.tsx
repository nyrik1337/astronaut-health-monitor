import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { App } from '../App';
import type { AssistantClient } from '../assistant/client';
import type { AssistantRequest, AssistantResponse } from '../assistant/types';
import { createMockExtensionClient } from '../cognitive/client';
import { FatigueView } from '../fatigueView/FatigueView';
import { RecoveryView } from '../recoveryView/RecoveryView';
import { fakeClient } from '../test/fixtures';
import { TRIAL_MS } from '../workingMemory/oneBack';
import { en, ru } from './dictionaries';
import { LanguageProvider, LanguageSwitch, translate } from '.';

const LAZY = { timeout: 5000 };
const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort();

/** Any view wrapped with the real provider and switch, as in the app header. */
function withSwitch(children: ReactNode) {
  return (
    <LanguageProvider>
      <LanguageSwitch />
      {children}
    </LanguageProvider>
  );
}
/** Step one symbol at a time so React re-renders between timers, like real playback. */
const stepTrials = (count: number): void => {
  for (let i = 0; i < count; i++) act(() => vi.advanceTimersByTime(TRIAL_MS));
};
const toRussian = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Русский' }));
};
const toEnglish = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'English' }));
};

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.lang = 'en';
});

describe('EN/RU dictionaries', () => {
  test('Russian covers every English key with non-empty text and the same placeholders', () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(ru[key].trim(), key).not.toBe('');
      expect(placeholders(ru[key]), key).toEqual(placeholders(en[key]));
    }
  });

  test('interpolates values and keeps unknown placeholders visible', () => {
    expect(translate('en', 'rc.trial', { n: 3, total: 20 })).toBe('Trial 3 of 20');
    expect(translate('ru', 'rc.trial', { n: 3, total: 20 })).toBe('Попытка 3 из 20');
    expect(translate('en', 'rc.trial', { n: 3 })).toBe('Trial 3 of {total}');
  });
});

describe('Language switch in the app', () => {
  test('English by default; RU translates header, tabs and journey without storing the choice', () => {
    render(<App client={fakeClient()} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Astronaut Health Monitor');
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');

    toRussian();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Монитор здоровья астронавтов');
    expect(screen.getByRole('tab', { name: 'Данные об усталости (эксперимент)' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Маршрут демонстрации' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('ru');
    expect(localStorage.length).toBe(0);

    toEnglish();
    expect(screen.getByRole('tab', { name: 'Vital signs dashboard' })).toHaveAttribute('aria-selected', 'true');
  });

  test('switching language keeps the mission replay day and the selected tab', async () => {
    const user = userEvent.setup();
    render(<App client={fakeClient()} />);
    await user.click(screen.getByRole('tab', { name: /Mission simulation/ }));
    await screen.findByRole('heading', { name: 'Mission simulation' }, LAZY);
    fireEvent.change(screen.getByLabelText('Mission day'), { target: { value: '120' } });

    toRussian();
    expect(screen.getByRole('heading', { name: 'Симуляция миссии' })).toBeInTheDocument();
    expect(screen.getByTestId('mission-day')).toHaveTextContent('120');
    expect(screen.getByRole('tab', { name: 'Симуляция миссии (синтетика)' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Active state survives a language switch', () => {
  test('a running working-memory run continues and finishes after switching to RU', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    render(withSwitch(<FatigueView client={createMockExtensionClient()} storage={null} />));
    const panel = screen.getByTestId('working-memory');
    fireEvent.click(within(panel).getByRole('button', { name: 'Start scored run' }));
    stepTrials(3);
    expect(within(panel).getByTestId('working-memory-progress')).toHaveTextContent('symbol 4 of 21');

    toRussian();
    expect(within(panel).getByTestId('working-memory-progress')).toHaveTextContent('символ 4 из 21');
    expect(within(panel).getByRole('button', { name: 'Стоп' })).toBeInTheDocument();
    stepTrials(18);
    expect(within(panel).getByTestId('working-memory-result')).toHaveTextContent('Серия завершена: верно 14 из 20');
  });

  test('evidence results, provenance and the AI conversation stay after switching', async () => {
    const user = userEvent.setup();
    const assistant: AssistantClient = {
      status: 'backend',
      // TEST-ONLY transport; production never fabricates AI answers.
      chat: (r: AssistantRequest) =>
        Promise.resolve<AssistantResponse>({
          subject_id: r.subject_id,
          mode: r.mode,
          clock: r.clock,
          as_of: r.as_of,
          answer: 'TEST ANSWER',
          model: 'qwen3:4b-instruct',
          generation: 'local_ollama',
          provenance: 'synthetic_demonstration',
          evidence: null,
          cognitive: null,
          limitations: ['AI-generated explanations are unvalidated.'],
          disclaimer: 'Not a medical diagnosis.',
          truncated: false,
        }),
    };
    render(withSwitch(<FatigueView client={createMockExtensionClient()} assistantClient={assistant} storage={null} />));
    await user.click(screen.getByRole('button', { name: 'Synthetic crew member reports fatigue' }));
    const result = await screen.findByTestId('evidence-result');
    expect(within(result).getAllByText('Missing').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'What evidence is missing?' }));
    await screen.findByTestId('assistant-answer');

    toRussian();
    const translated = screen.getByTestId('evidence-result');
    expect(within(translated).getAllByText('Отсутствует').length).toBeGreaterThan(0);
    expect(within(translated).getByText('Синтетическая демонстрация · часы миссии')).toBeInTheDocument();
    const answer = screen.getByTestId('assistant-answer');
    expect(within(answer).getByText('TEST ANSWER')).toBeInTheDocument();
    expect(within(answer).getByText(/Синтетическая демонстрация/)).toBeInTheDocument();
    expect(screen.getByText('Каких данных не хватает?', { selector: 'button' })).toBeInTheDocument();
  });

  test('a MindGuard check-in and a running breathing practice are kept', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
    render(withSwitch(<RecoveryView />));
    fireEvent.click(screen.getByRole('radio', { name: /4 High/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start breathing practice' }));
    act(() => vi.advanceTimersByTime(5_000));

    toRussian();
    expect(screen.getByRole('radio', { name: /4 Высокий/ })).toBeChecked();
    expect(screen.getByTestId('breathing-prompt')).toHaveTextContent('Медленно и спокойно выдохните');
    expect(screen.getByRole('button', { name: 'Пауза' })).toBeInTheDocument();
  });
});
