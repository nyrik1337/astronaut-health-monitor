/**
 * Experimental 1-back working-memory task (ORBITA's own design, not a validated instrument).
 *
 * A run is a sequence of symbols. The first symbol is a lead-in that is never scored, because it
 * has no previous symbol. Every later symbol is a scored trial: it is a MATCH when it is the same
 * as the symbol immediately before it. The participant presses "Match" only on matches.
 *
 * Pure and deterministic: randomness comes from an injected generator, scoring from the recorded
 * responses only. Nothing here is a reaction-time measurement or part of any personal baseline.
 */

export const SYMBOLS = [
  { glyph: '◆', name: 'diamond' },
  { glyph: '●', name: 'circle' },
  { glyph: '▲', name: 'triangle' },
  { glyph: '■', name: 'square' },
  { glyph: '★', name: 'star' },
  { glyph: '✚', name: 'cross' },
] as const;

export type SymbolIndex = number;

export interface RunSpec {
  readonly scoredTrials: number;
  readonly matches: number;
}

/** Short practice, then about 20 scored trials with a fixed 6 matches and 14 non-matches. */
export const PRACTICE: RunSpec = { scoredTrials: 6, matches: 2 };
export const SCORED: RunSpec = { scoredTrials: 20, matches: 6 };

/** Each symbol is shown for SYMBOL_MS, then a blank until TRIAL_MS; a response counts anywhere in TRIAL_MS. */
export const SYMBOL_MS = 1_500;
export const TRIAL_MS = 2_000;

export type Rng = () => number;

const pick = (rng: Rng, n: number): number => Math.min(n - 1, Math.floor(rng() * n));

/** Fisher–Yates shuffle of 0..n-1 without mutating inputs. */
function shuffledIndices(n: number, rng: Rng): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = pick(rng, i + 1);
    const a = out[i] as number;
    out[i] = out[j] as number;
    out[j] = a;
  }
  return out;
}

/**
 * Builds lead-in + `scoredTrials` symbols with EXACTLY `matches` matches: match positions are drawn
 * at random, and every non-match is forced to differ from its predecessor.
 */
export function generateSequence(spec: RunSpec, rng: Rng): SymbolIndex[] {
  if (spec.matches < 0 || spec.matches > spec.scoredTrials) throw new RangeError('Invalid match count.');
  const matchAt = new Set(shuffledIndices(spec.scoredTrials, rng).slice(0, spec.matches));
  const sequence: SymbolIndex[] = [pick(rng, SYMBOLS.length)];
  for (let t = 0; t < spec.scoredTrials; t++) {
    const previous = sequence[sequence.length - 1] as number;
    if (matchAt.has(t)) {
      sequence.push(previous);
    } else {
      const offset = 1 + pick(rng, SYMBOLS.length - 1);
      sequence.push((previous + offset) % SYMBOLS.length);
    }
  }
  return sequence;
}

/** True when position `i` (≥ 1) repeats the symbol immediately before it. */
export const isMatch = (sequence: readonly SymbolIndex[], i: number): boolean =>
  i >= 1 && sequence[i] === sequence[i - 1];

export interface OneBackScore {
  readonly scoredTrials: number;
  readonly matchTrials: number;
  readonly hits: number;
  readonly misses: number;
  readonly falseAlarms: number;
  readonly correctRejections: number;
  /** hits + correct rejections */
  readonly correct: number;
  /** correct / scored trials, 0–1 */
  readonly accuracy: number;
}

/**
 * `responded[i]` says whether "Match" was pressed while symbol i was on screen. The lead-in
 * (i = 0) is ignored. Hit = match + pressed; miss = match + not pressed; false alarm = non-match +
 * pressed; correct rejection = non-match + not pressed.
 */
export function scoreRun(sequence: readonly SymbolIndex[], responded: readonly boolean[]): OneBackScore {
  let hits = 0;
  let misses = 0;
  let falseAlarms = 0;
  let correctRejections = 0;
  for (let i = 1; i < sequence.length; i++) {
    const pressed = responded[i] === true;
    if (isMatch(sequence, i)) {
      if (pressed) hits++;
      else misses++;
    } else if (pressed) falseAlarms++;
    else correctRejections++;
  }
  const scoredTrials = Math.max(0, sequence.length - 1);
  const correct = hits + correctRejections;
  return {
    scoredTrials,
    matchTrials: hits + misses,
    hits,
    misses,
    falseAlarms,
    correctRejections,
    correct,
    accuracy: scoredTrials === 0 ? 0 : correct / scoredTrials,
  };
}

/* ---------- run state (pure reducer) ---------- */

export type Stage = 'practice' | 'scored';
export type RunStatus = 'running' | 'completed' | 'stopped' | 'invalidated';

export interface OneBackRun {
  readonly stage: Stage;
  readonly status: RunStatus;
  readonly sequence: readonly SymbolIndex[];
  /** Index of the symbol currently presented. */
  readonly index: number;
  readonly responded: readonly boolean[];
}

export type OneBackEvent =
  | { readonly type: 'respond' }
  | { readonly type: 'advance' }
  | { readonly type: 'stop' }
  | { readonly type: 'invalidate' };

export function startRun(stage: Stage, rng: Rng): OneBackRun {
  const sequence = generateSequence(stage === 'practice' ? PRACTICE : SCORED, rng);
  return { stage, status: 'running', sequence, index: 0, responded: sequence.map(() => false) };
}

export function oneBackReducer(run: OneBackRun, event: OneBackEvent): OneBackRun {
  if (run.status !== 'running') return run;
  switch (event.type) {
    case 'respond':
      // One response per symbol; the unscored lead-in ignores presses.
      if (run.index === 0 || run.responded[run.index]) return run;
      return { ...run, responded: run.responded.map((r, i) => (i === run.index ? true : r)) };
    case 'advance':
      return run.index + 1 >= run.sequence.length
        ? { ...run, status: 'completed' }
        : { ...run, index: run.index + 1 };
    case 'stop':
      return { ...run, status: 'stopped' };
    case 'invalidate':
      return { ...run, status: 'invalidated' };
  }
}
