import { useRef, type KeyboardEvent } from 'react';
import { useT, type TKey } from '../i18n';
import './viewTabs.css';

export type ViewId = 'dashboard' | 'mission' | 'fatigue' | 'recovery';

export const VIEWS: readonly { readonly id: ViewId; readonly label: TKey }[] = [
  { id: 'dashboard', label: 'shell.tab.dashboard' },
  { id: 'mission', label: 'shell.tab.mission' },
  { id: 'fatigue', label: 'shell.tab.fatigue' },
  { id: 'recovery', label: 'shell.tab.recovery' },
];

export const tabId = (view: ViewId): string => `view-tab-${view}`;
export const panelId = (view: ViewId): string => `view-panel-${view}`;

type Props = {
  value: ViewId;
  onChange: (view: ViewId) => void;
};

/** Tabs for switching views; arrow keys, Home and End move between tabs (WAI-ARIA tabs). */
export function ViewTabs({ value, onChange }: Props) {
  const { t } = useT();
  const refs = useRef(new Map<ViewId, HTMLButtonElement>());

  const select = (index: number): void => {
    const view = VIEWS[(index + VIEWS.length) % VIEWS.length];
    if (view === undefined) return;
    onChange(view.id);
    refs.current.get(view.id)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: VIEWS.length - 1,
    };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target);
  };

  return (
    <div className="view-tabs" role="tablist" aria-label={t('shell.views')}>
      {VIEWS.map((view, index) => {
        const selected = view.id === value;
        return (
          <button
            key={view.id}
            ref={(node) => {
              if (node) refs.current.set(view.id, node);
              else refs.current.delete(view.id);
            }}
            type="button"
            role="tab"
            id={tabId(view.id)}
            aria-selected={selected}
            aria-controls={panelId(view.id)}
            tabIndex={selected ? 0 : -1}
            className="view-tabs__tab"
            onClick={() => onChange(view.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {t(view.label)}
          </button>
        );
      })}
    </div>
  );
}
