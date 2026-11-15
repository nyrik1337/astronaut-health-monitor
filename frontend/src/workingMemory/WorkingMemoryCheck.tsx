import { useState } from 'react';
import { PRACTICE, SCORED, SYMBOLS, scoreRun, type OneBackScore, type Rng, type Stage } from './oneBack';
import { useOneBack } from './useOneBack';

const percent = (value: number): string => `${Math.round(value * 100)}%`;

const STATUS_TEXT = {
  stopped: 'Stopped. No score is shown for an unfinished run.',
  invalidated: 'Run invalidated because this tab or window lost focus. No score is shown; you can restart.',
} as const;

/**
 * Working Memory (experimental): an original 1-back task. Results stay in this component's memory
 * only. They are never sent to the reaction-time API, a personal baseline, the evidence inventory
 * or the AI Companion, and they are not a clinically validated measure.
 */
export function WorkingMemoryCheck({ rng }: { rng?: Rng }) {
  const task = useOneBack(rng);
  const [practiceScore, setPracticeScore] = useState<OneBackScore | null>(null);
  const [scored, setScored] = useState<OneBackScore | null>(null);
  const { run } = task;
  const running = run?.status === 'running';

  // Record the score once when a run completes (render-time derivation keeps it in sync).
  const finished = run?.status === 'completed' ? scoreRun(run.sequence, run.responded) : null;
  if (finished && run?.stage === 'practice' && practiceScore === null) setPracticeScore(finished);
  if (finished && run?.stage === 'scored' && scored === null) setScored(finished);

  const begin = (stage: Stage): void => {
    if (stage === 'scored') setScored(null);
    else setPracticeScore(null);
    task.start(stage);
  };
  const restart = (): void => {
    setPracticeScore(null);
    setScored(null);
    task.reset();
  };

  const symbol = run && running && task.symbolVisible ? SYMBOLS[run.sequence[run.index] ?? 0] : null;
  const pressed = run !== null && running && run.responded[run.index] === true;

  return (
    <div className="fatigue-panel working-memory" data-testid="working-memory">
      <p>
        <span className="tag">Experimental — not clinically validated</span> A short 1-back task. Symbols appear one at a
        time. Press <kbd>Space</kbd> or the <strong>Match</strong> button only when the symbol is the{' '}
        <strong>same as the one just before it</strong>. The first symbol is a warm-up and is never scored.
      </p>
      <p className="muted">
        Each symbol is shown for 1.5 s, followed by a short gap (2 s per symbol). The practice has {PRACTICE.scoredTrials}{' '}
        scored symbols with {PRACTICE.matches} matches; the main run has {SCORED.scoredTrials} scored symbols with exactly{' '}
        {SCORED.matches} matches, in random positions. Switching tabs or windows stops the run without a score. Results
        stay in this page’s memory only and are not added to your reaction-time history, baseline, evidence or AI
        Companion. Browser timing is uncalibrated, so this is not a measure of medical or operational performance.
      </p>

      <div className="button-row">
        {!running && (
          <button type="button" className="button" onClick={() => begin('practice')}>
            {practiceScore ? 'Repeat practice' : 'Start practice'}
          </button>
        )}
        {!running && (
          <button type="button" className="button button--primary" onClick={() => begin('scored')}>
            {scored ? 'Start a new scored run' : 'Start scored run'}
          </button>
        )}
        {running && (
          <button type="button" className="button" onClick={task.stop}>
            Stop
          </button>
        )}
        {!running && (practiceScore || scored || run) && (
          <button type="button" className="button" onClick={restart}>
            Restart
          </button>
        )}
      </div>

      {running && run && (
        <div className="reaction-check">
          <p className="muted" data-testid="working-memory-progress">
            {run.stage === 'practice' ? 'Practice' : 'Scored run'} · symbol {run.index + 1} of {run.sequence.length}
            {run.index === 0 ? ' (warm-up, not scored)' : ''}
          </p>
          <div className="reaction-check__area" data-testid="working-memory-stimulus">
            <span className="working-memory__symbol" aria-hidden="true">
              {symbol?.glyph ?? ''}
            </span>
            <span className="visually-hidden" aria-live="polite">
              {symbol ? symbol.name : ''}
            </span>
          </div>
          <div className="button-row">
            <button type="button" className="button button--primary" onClick={task.respond} aria-pressed={pressed}>
              {pressed ? 'Match recorded' : 'Match (Space)'}
            </button>
          </div>
        </div>
      )}

      {run && (run.status === 'stopped' || run.status === 'invalidated') && (
        <p className="working-memory__notice" role="status">
          {STATUS_TEXT[run.status]}
        </p>
      )}

      {practiceScore && !running && (
        <p role="status" data-testid="working-memory-practice">
          Practice finished: {practiceScore.correct} of {practiceScore.scoredTrials} correct ({practiceScore.hits} of{' '}
          {practiceScore.matchTrials} matches found, {practiceScore.falseAlarms} false alarms). Practice is not kept as a
          result.
        </p>
      )}

      {scored && !running && <ScoreSummary score={scored} />}
    </div>
  );
}

function ScoreSummary({ score }: { score: OneBackScore }) {
  return (
    <section className="fatigue-result" aria-label="Working memory result" data-testid="working-memory-result">
      <p className="fatigue-result__status" role="status">
        Run complete: {score.correct} of {score.scoredTrials} correct ({percent(score.accuracy)} response accuracy)
      </p>
      <dl className="facts facts--compact">
        <div>
          <dt>Hits (match, pressed)</dt>
          <dd className="numeric">{score.hits}</dd>
        </div>
        <div>
          <dt>Misses (match, not pressed)</dt>
          <dd className="numeric">{score.misses}</dd>
        </div>
        <div>
          <dt>False alarms (no match, pressed)</dt>
          <dd className="numeric">{score.falseAlarms}</dd>
        </div>
        <div>
          <dt>Correct rejections (no match, not pressed)</dt>
          <dd className="numeric">{score.correctRejections}</dd>
        </div>
      </dl>
      <p className="muted">
        How it is calculated: number correct = hits + correct rejections = {score.hits} + {score.correctRejections} ={' '}
        {score.correct}. Response accuracy = number correct ÷ {score.scoredTrials} scored symbols ={' '}
        {percent(score.accuracy)}. The warm-up symbol is not counted. Experimental and not clinically validated; it
        is not compared with any baseline and is not a diagnosis or a fitness-for-duty decision.
      </p>
    </section>
  );
}
