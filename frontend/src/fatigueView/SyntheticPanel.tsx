import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { AssistantContext } from '../assistant/context';
import type { ExtensionClient } from '../cognitive/client';
import {
  MISSION_CLOCK,
  syntheticAsOf,
  syntheticCurrent,
  syntheticEvidenceRequest,
  syntheticHistory,
  syntheticSubjectId,
} from '../cognitive/syntheticStore';
import type { CognitiveRequest, EvidenceRequest, NextCheck } from '../cognitive/types';
import { runMission } from '../mission/mission';
import { CREW_IDS, DEMO_SEED, MISSION_DAYS, type CrewId } from '../mission/types';
import { CallStatus } from './CallStatus';
import { CognitiveResult } from './CognitiveResult';
import { EvidenceResult } from './EvidenceResult';
import { useExtensionCall } from './useExtensionCall';
import { Rich, useT } from '../i18n';

const FIRST_DAY = 31;
const round = (value: number | undefined, decimals: number): number | null =>
  value === undefined ? null : Math.round(value * 10 ** decimals) / 10 ** decimals;

/**
 * Synthetic mission reassessment: a simulated crew member reports fatigue on a mission day.
 * Heart rate and sleep come from the synthetic 500-day mission; the reaction check is a scripted
 * synthetic session. Uses only the mission clock and `simulated` provenance — never real data.
 */
type Props = {
  client: ExtensionClient;
  /** Receives the raw requests behind the results currently shown, for the AI Companion. */
  onContextChange?: (context: AssistantContext) => void;
};

export function SyntheticPanel({ client, onContextChange }: Props) {
  const { t } = useT();
  const mission = useMemo(() => runMission(DEMO_SEED), []);
  const [crew, setCrew] = useState<CrewId>('B');
  const [day, setDay] = useState(70);
  const [sleepHours, setSleepHours] = useState<number | null>(null);
  const [reactionMedian, setReactionMedian] = useState<number | null>(null);
  const assess = useCallback((r: EvidenceRequest, s: AbortSignal) => client.assessEvidence(r, s), [client]);
  const analyze = useCallback((r: CognitiveRequest, s: AbortSignal) => client.analyzeCognitive(r, s), [client]);
  const evidence = useExtensionCall(assess);
  const cognitive = useExtensionCall(analyze);

  const shownEvidence = evidence.shownRequest;
  const shownCognitive = cognitive.shownRequest;
  useEffect(() => {
    onContextChange?.({
      subject_id: syntheticSubjectId(crew),
      mode: 'simulation',
      clock: MISSION_CLOCK,
      as_of: syntheticAsOf(day),
      evidence: shownEvidence,
      cognitive: shownCognitive,
    });
  }, [onContextChange, crew, day, shownEvidence, shownCognitive]);

  const heartRate = round(mission.generated.values[crew].cardio[day - 1], 0);
  const missionSleep = round(mission.generated.values[crew].sleep[day - 1], 1);
  const evidenceRequest = (sleep: number | null, reaction: number | null): EvidenceRequest =>
    syntheticEvidenceRequest({ crew, day, heartRate, sleepHours: sleep, reactionMedianMs: reaction });
  const cognitiveRequest = (): CognitiveRequest => ({
    subject_id: syntheticSubjectId(crew),
    mode: 'simulation',
    clock: MISSION_CLOCK,
    as_of: syntheticAsOf(day),
    current_test: syntheticCurrent(crew, day),
    history: syntheticHistory(crew, day),
    context_observations: [],
    notices: [],
  });

  const restart = (): void => {
    setSleepHours(null);
    setReactionMedian(null);
    evidence.reset();
    cognitive.reset();
  };
  const reportFatigue = (): void => {
    restart();
    void evidence.run(evidenceRequest(null, null));
  };
  const onCheck = async (code: NextCheck['code']): Promise<void> => {
    if (code === 'sleep_check_in') {
      setSleepHours(missionSleep);
      await evidence.run(evidenceRequest(missionSleep, reactionMedian));
      return;
    }
    if (code === 'reaction_time_check') {
      const result = await cognitive.run(cognitiveRequest());
      const median = result?.current.median_reaction_time_ms ?? null;
      if (median === null) return;
      setReactionMedian(median);
      // Reassess only after the cognitive response, with a summary from the same (synthetic) mode.
      await evidence.run(evidenceRequest(sleepHours, median));
    }
  };
  const onDay = (event: ChangeEvent<HTMLInputElement>): void => {
    const value = Math.round(Number(event.target.value));
    if (Number.isFinite(value)) {
      setDay(Math.min(MISSION_DAYS, Math.max(FIRST_DAY, value)));
      restart();
    }
  };

  return (
    <div className="fatigue-panel" data-mode="simulation">
      <p>
        <span className="tag">{t('syn.tag')}</span>{' '}
        <Rich text={t('syn.intro', { subject: syntheticSubjectId(crew), clock: MISSION_CLOCK.id, day })} />
      </p>
      <div className="fatigue-controls">
        <div className="field">
          <label htmlFor="synthetic-crew">{t('syn.crew')}</label>
          <select
            id="synthetic-crew"
            value={crew}
            onChange={(e) => {
              setCrew(e.target.value as CrewId);
              restart();
            }}
          >
            {CREW_IDS.map((c) => (
              <option key={c} value={c}>
                {t('syn.crewOption', { crew: c })}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="synthetic-day">{t('syn.day')}</label>
          <input id="synthetic-day" type="number" min={FIRST_DAY} max={MISSION_DAYS} value={day} onChange={onDay} />
        </div>
      </div>
      <div className="button-row">
        <button type="button" className="button button--primary" onClick={reportFatigue}>
          {t('syn.report')}
        </button>
      </div>
      <CallStatus state={evidence.state} label={t('call.evidence')} onRetry={reportFatigue} />
      {evidence.state.phase === 'success' && (
        <EvidenceResult
          response={evidence.state.data}
          onCheck={(code) => void onCheck(code)}
          availableChecks={['sleep_check_in', 'reaction_time_check']}
        />
      )}
      <CallStatus state={cognitive.state} label={t('call.synCog')} onRetry={() => void onCheck('reaction_time_check')} />
      {cognitive.state.phase === 'success' && <CognitiveResult response={cognitive.state.data} />}
    </div>
  );
}
