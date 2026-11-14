import { useCallback, useMemo, useRef, useState } from 'react';
import { detectPlatform, isTouchOnly } from '../cognitive/browserContext';
import type { ExtensionClient } from '../cognitive/client';
import {
  EMPTY_REAL_STORE,
  clearRealStore,
  hasSavedRealStore,
  historyBefore,
  isValidParticipantId,
  loadRealStore,
  newSetupId,
  nextPhase,
  saveRealStore,
  withSession,
  withSetup,
  type RealSetup,
  type RealStoreData,
} from '../cognitive/realStore';
import { toSession, type RtState } from '../cognitive/rtEngine';
import { usable } from '../cognitive/summary';
import { UTC_CLOCK, type CognitiveRequest, type EvidenceRequest, type NextCheck, type Observation } from '../cognitive/types';
import { CallStatus } from './CallStatus';
import { CognitiveResult } from './CognitiveResult';
import { EvidenceResult } from './EvidenceResult';
import { ReactionCheck } from './ReactionCheck';
import { useExtensionCall } from './useExtensionCall';

type Props = {
  client: ExtensionClient;
  userAgent?: string;
  now?: () => number;
  storage?: Storage | null;
};

const SELF = { kind: 'human_entered', source_id: null } as const;

/**
 * Real participant: UTC clock, opaque participant ID, browser-measured reaction checks stored only
 * in this browser. Kept fully separate from synthetic mission subjects.
 */
export function RealPanel({ client, userAgent, now = () => Date.now(), storage }: Props) {
  // Memory only by default; earlier data exists in storage only if the participant opted in.
  const [keep, setKeep] = useState(() => hasSavedRealStore(storage));
  const [store, setStore] = useState<RealStoreData>(() => (keep ? loadRealStore(storage) : EMPTY_REAL_STORE));
  const [participant, setParticipant] = useState('participant-01');
  const [deviceClass, setDeviceClass] = useState<RealSetup['device_class']>(store.setup?.device_class ?? 'laptop');
  const [sleepInput, setSleepInput] = useState('');
  const [latest, setLatest] = useState<{ median: number; endedAt: string; usable: boolean } | null>(null);
  const sleepRef = useRef<HTMLInputElement>(null);
  const assess = useCallback((r: EvidenceRequest, s: AbortSignal) => client.assessEvidence(r, s), [client]);
  const analyze = useCallback((r: CognitiveRequest, s: AbortSignal) => client.analyzeCognitive(r, s), [client]);
  const evidence = useExtensionCall(assess);
  const cognitive = useExtensionCall(analyze);

  const platform = useMemo(() => detectPlatform(userAgent ?? navigator.userAgent), [userAgent]);
  const touch = useMemo(() => typeof window !== 'undefined' && isTouchOnly(window), []);
  const validId = isValidParticipantId(participant);
  const sessions = store.participants[participant] ?? [];
  const setup: RealSetup = store.setup ?? { setup_id: 'not-yet-created', device_class: deviceClass };
  const sleepHours = sleepInput.trim() === '' ? null : Number(sleepInput);
  const sleepValid = sleepHours === null || (Number.isFinite(sleepHours) && sleepHours >= 0 && sleepHours <= 24);
  const unsupported = !validId
    ? 'Enter an opaque participant ID (letters, digits, - or _; no names).'
    : touch
      ? 'Touch devices are not supported by this check (desktop or laptop keyboard only).'
      : platform.ok
        ? null
        : platform.reason;

  const persist = (next: RealStoreData): void => {
    setStore(next);
    if (keep) saveRealStore(next, storage);
  };
  const onKeepChange = (checked: boolean): void => {
    setKeep(checked);
    if (checked) saveRealStore(store, storage);
    else clearRealStore(storage);
  };
  const clearAll = (): void => {
    setStore(EMPTY_REAL_STORE);
    clearRealStore(storage);
    setKeep(false);
    setLatest(null);
    evidence.reset();
    cognitive.reset();
  };
  const ensureSetup = (): RealSetup => {
    if (store.setup) return store.setup;
    const created = { setup_id: newSetupId(), device_class: deviceClass };
    persist(withSetup(store, created));
    return created;
  };

  const observations = (at: string, cognitiveSummary: typeof latest): Observation[] => {
    const out: Observation[] = [];
    if (sleepHours !== null && sleepValid) {
      out.push({ kind: 'sleep_duration', observed_at: at, value: sleepHours, source: SELF, quality: { status: 'unknown', reasons: [] } });
    }
    if (cognitiveSummary) {
      out.push({
        kind: 'cognitive_test',
        observed_at: cognitiveSummary.endedAt,
        value: cognitiveSummary.median,
        source: { kind: 'browser_measured', source_id: null },
        // An interrupted or low-count attempt must not look like valid evidence.
        quality: cognitiveSummary.usable
          ? { status: 'unknown', reasons: [] }
          : { status: 'poor', reasons: ['Reaction-time attempt was interrupted or had fewer than 16 valid responses.'] },
      });
    }
    return out;
  };
  const evidenceRequest = (cognitiveSummary: typeof latest): EvidenceRequest => {
    const at = new Date(now()).toISOString();
    return {
      subject_id: participant,
      mode: 'real_assessment',
      clock: UTC_CLOCK,
      as_of: at,
      reported_issue: { code: 'fatigue', reported_at: at, source: SELF },
      observations: observations(at, cognitiveSummary),
      notices: [],
    };
  };

  const reportFatigue = (): void => void evidence.run(evidenceRequest(latest));

  const onFinished = useCallback(
    (state: RtState) => {
      const activeSetup = ensureSetup();
      if (!platform.ok) return;
      const session = toSession(state, {
        session_id: `real-${crypto.randomUUID()}`,
        subject_id: participant,
        clock: UTC_CLOCK,
        phase: nextPhase(sessions, activeSetup.setup_id),
        source: { kind: 'browser_measured', source_id: null },
        context: { ...platform.platform, setup_id: activeSetup.setup_id, device_class: activeSetup.device_class, input_method: 'keyboard_space', timing_api: 'performance_now' },
      });
      if (session === null) return;
      const history = historyBefore(sessions, Date.parse(session.started_at));
      persist(withSession(store.setup ? store : withSetup(store, activeSetup), participant, session));
      const at = new Date(Math.max(now(), Date.parse(session.ended_at))).toISOString();
      void cognitive.run({
        subject_id: participant,
        mode: 'real_assessment',
        clock: UTC_CLOCK,
        as_of: at,
        current_test: session,
        history,
        context_observations: observations(at, null),
        notices: [],
      }).then((result) => {
        const median = result?.current.median_reaction_time_ms ?? null;
        if (median === null) return;
        const summary = { median, endedAt: session.ended_at, usable: usable(session) };
        setLatest(summary);
        void evidence.run(evidenceRequest(summary));
      });
    },
    // The check reports once per attempt; the values captured at that moment are the right ones.
    [store, participant, sessions, platform, sleepInput, deviceClass, keep],
  );

  const onCheck = (code: NextCheck['code']): void => {
    if (code === 'sleep_check_in') sleepRef.current?.focus();
  };
  return (
    <div className="fatigue-panel" data-mode="real_assessment">
      <p>
        <span className="tag">Real participant</span> UTC clock. This is your own browser measurement, not astronaut
        or NASA data. Results stay in this page’s memory and are lost on reload unless you choose to keep them below.
        They are never added to a synthetic crew member’s history.
      </p>
      <label className="fatigue-consent">
        <input type="checkbox" checked={keep} onChange={(e) => onKeepChange(e.target.checked)} /> Keep my real-participant
        results in this browser after reload (stored only on this device until you clear them).
      </label>
      <div className="fatigue-controls">
        <div className="field">
          <label htmlFor="participant-id">Participant ID (opaque, no names)</label>
          <input id="participant-id" value={participant} onChange={(e) => setParticipant(e.target.value.trim())} aria-invalid={!validId} />
        </div>
        <div className="field">
          <label htmlFor="device-class">This computer is a</label>
          <select id="device-class" value={setup.device_class} disabled={store.setup !== null} onChange={(e) => setDeviceClass(e.target.value as RealSetup['device_class'])}>
            <option value="laptop">Laptop</option>
            <option value="desktop">Desktop</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="sleep-hours">Optional sleep check-in: hours slept in the last 24 h</label>
          <input id="sleep-hours" ref={sleepRef} type="number" min={0} max={24} step={0.5} value={sleepInput} onChange={(e) => setSleepInput(e.target.value)} aria-invalid={!sleepValid} />
        </div>
      </div>
      <p className="muted">
        Setup ID <code>{setup.setup_id}</code> · {sessions.length} stored session(s) for this participant.
      </p>
      <div className="button-row">
        <button type="button" className="button button--primary" onClick={reportFatigue} disabled={!validId || !sleepValid}>
          I feel fatigued — show the evidence
        </button>
        <button type="button" className="button" onClick={() => persist(withSetup(store, { setup_id: newSetupId(), device_class: deviceClass }))}>
          Hardware changed: new setup ID
        </button>
        <button type="button" className="button" onClick={clearAll}>
          Clear real participant data
        </button>
      </div>
      <CallStatus state={evidence.state} label="Assessing evidence" onRetry={reportFatigue} />
      {evidence.state.phase === 'success' && (
        <EvidenceResult response={evidence.state.data} onCheck={onCheck} availableChecks={['sleep_check_in']} />
      )}
      <ReactionCheck phase={nextPhase(sessions, setup.setup_id)} unsupported={unsupported} onFinished={onFinished} />
      <CallStatus state={cognitive.state} label="Analysing the reaction-time check" onRetry={reportFatigue} />
      {cognitive.state.phase === 'success' && <CognitiveResult response={cognitive.state.data} />}
    </div>
  );
}
