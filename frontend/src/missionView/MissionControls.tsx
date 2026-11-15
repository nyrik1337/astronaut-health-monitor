import type { ChangeEvent } from 'react';
import { BASELINE_DAYS, MISSION_DAYS } from '../mission/types';
import type { ScenarioEvent } from '../mission/types';
import { useT } from '../i18n';
import { BASE_DAYS_PER_SECOND, SPEEDS, isSpeed, type Speed } from './playback';

type Props = {
  day: number;
  playing: boolean;
  speed: Speed;
  events: readonly ScenarioEvent[];
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSeek: (day: number) => void;
  onSpeed: (speed: Speed) => void;
};


export function MissionControls(props: Props) {
  const { day, playing, speed, events, onPlay, onPause, onReset, onSeek, onSpeed } = props;
  const { t } = useT();

  const handleSpeed = (event: ChangeEvent<HTMLSelectElement>): void => {
    const value = Number(event.target.value);
    if (isSpeed(value)) onSpeed(value);
  };

  return (
    <section className="mission-controls" aria-labelledby="mission-controls-heading">
      <h3 id="mission-controls-heading" className="section-heading">
        {t('mc.title')}
      </h3>
      <p className="mission-controls__day">
        {t('mc.day')} <span className="numeric" data-testid="mission-day">{day}</span>
        <span className="muted"> {t('mc.of', { total: MISSION_DAYS })}</span>
      </p>
      {day <= BASELINE_DAYS && (
        <p className="mission-controls__phase">
          {t('mc.baseline', { day, total: BASELINE_DAYS, next: BASELINE_DAYS + 1 })}
        </p>
      )}
      <div className="button-row">
        {playing ? (
          <button type="button" className="button button--primary" onClick={onPause}>
            {t('mc.pause')}
          </button>
        ) : (
          <button type="button" className="button button--primary" onClick={onPlay}>
            {t('mc.play')}
          </button>
        )}
        <button type="button" className="button" onClick={onReset}>
          {t('mc.reset')}
        </button>
      </div>
      <div className="mission-controls__row">
        <div className="field">
          <label htmlFor="mission-speed">{t('mc.speed')}</label>
          <select id="mission-speed" value={speed} onChange={handleSpeed}>
            {SPEEDS.map((option) => (
              <option key={option} value={option}>
                {t('mc.speedOption', { speed: option, days: Math.round(BASE_DAYS_PER_SECOND * option) })}
              </option>
            ))}
          </select>
        </div>
        <div className="field mission-controls__timeline">
          <label htmlFor="mission-timeline">{t('mc.timeline')}</label>
          <input
            id="mission-timeline"
            type="range"
            min={1}
            max={MISSION_DAYS}
            step={1}
            value={day}
            onChange={(event) => onSeek(Number(event.target.value))}
          />
        </div>
      </div>
      <div className="mission-controls__events">
        <p className="muted">{t('mc.events')}</p>
        <ul className="mission-events">
          {events.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                className="button button--small"
                aria-pressed={day >= event.markerDay}
                onClick={() => onSeek(event.markerDay)}
              >
                {t('mc.event', { day: event.markerDay, label: t(`scenario.${event.id}`) })}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
