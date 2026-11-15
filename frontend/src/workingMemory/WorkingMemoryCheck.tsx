import { useState } from 'react';
import { PRACTICE, SCORED, SYMBOLS, scoreRun, type OneBackScore, type Rng, type Stage } from './oneBack';
import { useOneBack } from './useOneBack';
import { Rich, useT } from '../i18n';

const percent = (value: number): string => `${Math.round(value * 100)}%`;

const STATUS_TEXT = {
  stopped: 'wm.stopped',
  invalidated: 'wm.invalidated',
} as const;

/**
 * Working Memory (experimental): an original 1-back task. Results stay in this component's memory
 * only. They are never sent to the reaction-time API, a personal baseline, the evidence inventory
 * or the AI Companion, and they are not a clinically validated measure.
 */
export function WorkingMemoryCheck({ rng }: { rng?: Rng }) {
  const { t } = useT();
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
        <span className="tag">{t('wm.tag')}</span> <Rich text={t('wm.intro')} />
      </p>
      <p className="muted">
        {t('wm.details', {
          practiceTrials: PRACTICE.scoredTrials,
          practiceMatches: PRACTICE.matches,
          trials: SCORED.scoredTrials,
          matches: SCORED.matches,
        })}
      </p>

      <div className="button-row">
        {!running && (
          <button type="button" className="button" onClick={() => begin('practice')}>
            {practiceScore ? t('wm.repeatPractice') : t('wm.startPractice')}
          </button>
        )}
        {!running && (
          <button type="button" className="button button--primary" onClick={() => begin('scored')}>
            {scored ? t('wm.newScored') : t('wm.startScored')}
          </button>
        )}
        {running && (
          <button type="button" className="button" onClick={task.stop}>
            {t('wm.stop')}
          </button>
        )}
        {!running && (practiceScore || scored || run) && (
          <button type="button" className="button" onClick={restart}>
            {t('wm.restart')}
          </button>
        )}
      </div>

      {running && run && (
        <div className="reaction-check">
          <p className="muted" data-testid="working-memory-progress">
            {t('wm.progress', { stage: t(`wm.stage.${run.stage}`), n: run.index + 1, total: run.sequence.length })}
            {run.index === 0 ? t('wm.warmup') : ''}
          </p>
          <div className="reaction-check__area" data-testid="working-memory-stimulus">
            <span className="working-memory__symbol" aria-hidden="true">
              {symbol?.glyph ?? ''}
            </span>
            <span className="visually-hidden" aria-live="polite">
              {symbol ? t(`wm.symbol.${symbol.name}`) : ''}
            </span>
          </div>
          <div className="button-row">
            <button type="button" className="button button--primary" onClick={task.respond} aria-pressed={pressed}>
              {pressed ? t('wm.matched') : t('wm.match')}
            </button>
          </div>
        </div>
      )}

      {run && (run.status === 'stopped' || run.status === 'invalidated') && (
        <p className="working-memory__notice" role="status">
          {t(STATUS_TEXT[run.status])}
        </p>
      )}

      {practiceScore && !running && (
        <p role="status" data-testid="working-memory-practice">
          {t('wm.practiceDone', {
            correct: practiceScore.correct,
            total: practiceScore.scoredTrials,
            hits: practiceScore.hits,
            matchTrials: practiceScore.matchTrials,
            falseAlarms: practiceScore.falseAlarms,
          })}
        </p>
      )}

      {scored && !running && <ScoreSummary score={scored} />}
    </div>
  );
}

function ScoreSummary({ score }: { score: OneBackScore }) {
  const { t } = useT();
  const accuracy = percent(score.accuracy);
  return (
    <section className="fatigue-result" aria-label={t('wm.result')} data-testid="working-memory-result">
      <p className="fatigue-result__status" role="status">
        {t('wm.complete', { correct: score.correct, total: score.scoredTrials, accuracy })}
      </p>
      <dl className="facts facts--compact">
        <div>
          <dt>{t('wm.hits')}</dt>
          <dd className="numeric">{score.hits}</dd>
        </div>
        <div>
          <dt>{t('wm.misses')}</dt>
          <dd className="numeric">{score.misses}</dd>
        </div>
        <div>
          <dt>{t('wm.falseAlarms')}</dt>
          <dd className="numeric">{score.falseAlarms}</dd>
        </div>
        <div>
          <dt>{t('wm.rejections')}</dt>
          <dd className="numeric">{score.correctRejections}</dd>
        </div>
      </dl>
      <p className="muted">
        {t('wm.how', {
          hits: score.hits,
          rejections: score.correctRejections,
          correct: score.correct,
          total: score.scoredTrials,
          accuracy,
        })}
      </p>
    </section>
  );
}
