const MINUS_SIGN = '−';

const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatNumber(value: number, decimals: number): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const isNegative = value < 0 && Number(fixed) !== 0;
  return isNegative ? `${MINUS_SIGN}${fixed}` : fixed;
}

/** Always shows a sign, e.g. "+4.0" or "−0.3". Zero is shown without a sign. */
export function formatSigned(value: number, decimals: number): string {
  const fixed = Math.abs(value).toFixed(decimals);
  if (Number(fixed) === 0) {
    return fixed;
  }
  return `${value > 0 ? '+' : MINUS_SIGN}${fixed}`;
}

export function withUnit(text: string, unit: string): string {
  return unit === '' ? text : `${text} ${unit}`;
}

/** "14:30" in UTC. Accepts epoch milliseconds or an ISO timestamp. */
export function formatClock(time: number | string): string {
  return clockFormatter.format(new Date(time));
}

/** "04 Oct 2026, 14:30 UTC". */
export function formatDateTime(time: number | string): string {
  return `${dateTimeFormatter.format(new Date(time))} UTC`;
}

/** True when two ISO timestamps denote the same instant (the backend normalizes to UTC `Z`). */
export function isSameInstant(a: string, b: string): boolean {
  const left = Date.parse(a);
  const right = Date.parse(b);
  return Number.isFinite(left) && left === right;
}
