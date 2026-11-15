import { useT, type TKey } from '../i18n';
import type { ViewId } from './ViewTabs';

/**
 * Presentation shortcut: five steps through EXISTING sections. Each step only switches the tab
 * and scrolls to a heading — it creates no data and runs no algorithm.
 */
export interface JourneyStep {
  readonly label: TKey;
  readonly view: ViewId;
  readonly target: string;
}

export const JOURNEY: readonly JourneyStep[] = [
  { label: 'journey.1', view: 'mission', target: 'mission-heading' },
  { label: 'journey.2', view: 'fatigue', target: 'synthetic-heading' },
  { label: 'journey.3', view: 'fatigue', target: 'evidence-guide-heading' },
  { label: 'journey.4', view: 'fatigue', target: 'real-heading' },
  { label: 'journey.5', view: 'fatigue', target: 'assistant-heading' },
];

const MAX_WAIT_FRAMES = 120;

/**
 * Scrolls to and focuses a heading, waiting a few frames until its tab is shown and any lazily
 * loaded view has rendered (a heading inside a hidden tab panel has no layout box).
 */
export function revealHeading(id: string, frames = 0): void {
  const element = document.getElementById(id);
  if (element === null || element.getClientRects().length === 0) {
    if (frames < MAX_WAIT_FRAMES) requestAnimationFrame(() => revealHeading(id, frames + 1));
    return;
  }
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
  element.scrollIntoView?.({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
  element.focus({ preventScroll: true });
}

export function DemoJourney({ onGo }: { onGo: (view: ViewId) => void }) {
  const { t } = useT();
  return (
    <nav className="journey" aria-label={t('journey.label')}>
      <span className="journey__label">{t('journey.label')}</span>
      <ol>
        {JOURNEY.map((step, index) => (
          <li key={step.label}>
            <button
              type="button"
              className="journey__step"
              onClick={() => {
                onGo(step.view);
                // Wait for React to show the selected tab before looking for the heading.
                requestAnimationFrame(() => revealHeading(step.target));
              }}
            >
              <span className="journey__num" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              {t(step.label)}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
