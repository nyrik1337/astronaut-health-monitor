import type { ChangeEvent } from 'react';
import { BASELINE_DAYS, MISSION_DAYS } from '../mission/types';
import type { ScenarioEvent } from '../mission/types';
import { SCENARIO_LABELS } from './labels';
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

const speedLabel = (speed: Speed): string =>
  `${speed}× (about ${Math.round(BASE_DAYS_PER_SECOND * speed)} days per second)`;

export function MissionControls(props: Props) {
  const { day, playing, speed, events, onPlay, onPause, onReset, onSeek, onSpeed } = props;

  const handleSpeed = (event: ChangeEvent<HTMLSelectElement>): void => {
    const value = Number(event.target.value);
    if (isSpeed(value)) onSpeed(value);
  };

  return (
    <section className="mission-controls" aria-labelledby="mission-controls-heading">
      <h3 id="mission-controls-heading" className="section-heading">
        Replay controls
      </h3>
      <p className="mission-controls__day">
        Day <span className="numeric" data-testid="mission-day">{day}</span>
        <span className="muted"> of {MISSION_DAYS}</span>
      </p>
      {day <= BASELINE_DAYS && (
        <p className="mission-controls__phase">
          Baseline building: day {day} of {BASELINE_DAYS}. Nothing is evaluated until day{' '}
          {BASELINE_DAYS + 1}.
        </p>
      )}
      <div className="button-row">
        {playing ? (
          <button type="button" className="button button--primary" onClick={onPause}>
            Pause
          </button>
        ) : (
          <button type="button" className="button button--primary" onClick={onPlay}>
            Play
          </button>
        )}
        <button type="button" className="button" onClick={onReset}>
          Reset
        </button>
      </div>
      <div className="mission-controls__row">
        <div className="field">
          <label htmlFor="mission-speed">Playback speed</label>
          <select id="mission-speed" value={speed} onChange={handleSpeed}>
            {SPEEDS.map((option) => (
              <option key={option} value={option}>
                {speedLabel(option)}
              </option>
            ))}
          </select>
        </div>
        <div className="field mission-controls__timeline">
          <label htmlFor="mission-timeline">Mission day</label>
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
        <p className="muted">Scripted events in this synthetic replay (jump to day):</p>
        <ul className="mission-events">
          {events.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                className="button button--small"
                aria-pressed={day >= event.markerDay}
                onClick={() => onSeek(event.markerDay)}
              >
                Day {event.markerDay}: {SCENARIO_LABELS[event.id]}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
