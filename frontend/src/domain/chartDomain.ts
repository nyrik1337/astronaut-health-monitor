const PADDING_RATIO = 0.2;

/**
 * Y-axis range that contains every value and the baseline median, padded so that a
 * flat series (e.g. constant SpO₂) still has visible vertical room. Purely visual.
 */
export function computeYDomain(
  values: readonly number[],
  median: number | null,
  decimals: number,
): readonly [number, number] | null {
  const all = median === null ? values : [...values, median];
  if (all.length === 0) {
    return null;
  }
  const min = Math.min(...all);
  const max = Math.max(...all);
  const minimumPadding = 10 ** -decimals;
  const padding = Math.max((max - min) * PADDING_RATIO, minimumPadding);
  const factor = 10 ** decimals;
  return [Math.floor((min - padding) * factor) / factor, Math.ceil((max + padding) * factor) / factor];
}
