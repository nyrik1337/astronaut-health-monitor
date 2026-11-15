/**
 * Mission simulation view: a synthetic 500-day replay of the experimental on-board detectors.
 * The mission is computed once in the browser from a fixed seed; the playback clock only chooses
 * the day. Nothing in this view calls the backend.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { runMission } from '../mission/mission';
import { missionMeta, snapshotAt } from '../mission/snapshot';
import { DEMO_SEED } from '../mission/types';
import { CrewGrid, type CellSelection } from './CrewGrid';
import { EnvironmentStatus } from './EnvironmentStatus';
import { EventFeed } from './EventFeed';
import { MeasurementDetails } from './MeasurementDetails';
import { MissionControls } from './MissionControls';
import { useT, type TFn } from '../i18n';
import { usePlayback } from './usePlayback';
import './mission.css';

/** Text for the polite live region when new notifications appear (empty otherwise). */
function useAnnouncement(day: number, titles: readonly string[], t: TFn): string {
  const [message, setMessage] = useState('');
  const previous = useRef({ day, count: titles.length });

  useEffect(() => {
    const before = previous.current;
    previous.current = { day, count: titles.length };
    if (day < before.day || titles.length <= before.count) return;
    const added = titles.slice(0, titles.length - before.count);
    setMessage(
      added.length === 1
        ? t('ms.announce.one', { day, title: added[0] ?? '' })
        : t('ms.announce.many', { day, count: added.length }),
    );
    // The announcement is written once per change of day; language switches do not re-announce.
  }, [day, titles]);

  return message;
}

export function MissionView() {
  const { t } = useT();
  const mission = useMemo(() => runMission(DEMO_SEED), []);
  const meta = useMemo(() => missionMeta(mission, 0), [mission]);
  const playback = usePlayback();
  const snapshot = useMemo(() => snapshotAt(mission, playback.day), [mission, playback.day]);
  const [selection, setSelection] = useState<CellSelection | null>(null);
  const titles = useMemo(() => snapshot.alerts.map((a) => a.title), [snapshot]);
  const announcement = useAnnouncement(snapshot.day, titles, t);

  return (
    <div className="mission">
      <div className="mission__intro">
        <h2 id="mission-heading" className="mission__title">
          {t('ms.title')}
        </h2>
        <p className="mission__notice">
          <span className="tag">{t('ms.tag')}</span> {t('ms.notice')}
        </p>
      </div>
      <p className="visually-hidden" aria-live="polite" data-testid="mission-announcement">
        {announcement}
      </p>
      <MissionControls
        day={snapshot.day}
        playing={playback.playing}
        speed={playback.speed}
        events={meta.events}
        onPlay={playback.play}
        onPause={playback.pause}
        onReset={playback.reset}
        onSeek={playback.seek}
        onSpeed={playback.setSpeed}
      />
      <div className="mission__body">
        <div className="mission__main">
          <CrewGrid
            day={snapshot.day}
            grid={snapshot.grid}
            selected={selection}
            onSelect={setSelection}
          />
          <MeasurementDetails
            mission={mission}
            selection={selection}
            day={snapshot.day}
            alerts={snapshot.alerts}
          />
          <EnvironmentStatus environment={snapshot.environment} />
        </div>
        <EventFeed snapshot={snapshot} />
      </div>
    </div>
  );
}

export default MissionView;
