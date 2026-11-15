import type { MetricDefinition } from '../domain/metrics';
import { isKey, type TFn } from '../i18n';

/** Translated metric name; unknown metric keys fall back to the definition's own label. */
export function vitalLabel(definition: MetricDefinition, t: TFn): string {
  const key = `vital.${definition.key}`;
  return isKey(key) ? t(key) : definition.label;
}
