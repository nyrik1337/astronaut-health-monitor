import { ILLUSTRATIVE_EVENT_DOSE_REFERENCE_MSV } from '../mission/types';
import type { Snapshot } from '../mission/types';
import { formatValue } from './labels';

type Props = {
  environment: Snapshot['environment'];
};

/** Simulated module environment, kept separate from the crew health signals. */
export function EnvironmentStatus({ environment }: Props) {
  return (
    <section className="mission-environment" aria-labelledby="mission-environment-heading">
      <h3 id="mission-environment-heading" className="section-heading">
        Simulated environment
      </h3>
      {environment.particleEventActive && (
        <p className="mission-environment__event" role="status">
          Simulated particle event in progress: daily dose is far above baseline for all four
          synthetic crew members.
        </p>
      )}
      <dl className="facts facts--compact">
        <div>
          <dt>Dose of the latest simulated event</dt>
          <dd className="numeric">{formatValue(environment.eventDoseMSv, 1)} mSv</dd>
        </div>
        <div>
          <dt>Cumulative dose (crew mean)</dt>
          <dd className="numeric">{formatValue(environment.totalDoseMSv, 1)} mSv</dd>
        </div>
        <div>
          <dt>Module CO₂ reading (arbitrary units)</dt>
          <dd className="numeric">{formatValue(environment.co2, 2)}</dd>
        </div>
        <div>
          <dt>Module noise reading</dt>
          <dd className="numeric">{formatValue(environment.noise, 1)} dB</dd>
        </div>
      </dl>
      <p className="muted mission-note">
        Event dose is shown against an illustrative {ILLUSTRATIVE_EVENT_DOSE_REFERENCE_MSV} mSv
        simulation reference, which is not a validated action threshold.
      </p>
    </section>
  );
}
