/** RMS referenced to digital amplitude 1.0, never sound-pressure level. */
export function levels(sumSquares: number, frames: number): { rms: number; dbfs: number | null } {
  if (!Number.isFinite(sumSquares) || sumSquares < 0 || !Number.isSafeInteger(frames) || frames <= 0) {
    throw new Error('Invalid audio aggregate');
  }
  const rms = Math.sqrt(sumSquares / frames);
  return { rms, dbfs: rms === 0 ? null : 20 * Math.log10(rms) };
}

export type Measurement = ReturnType<typeof levels> & {
  deviceId: string;
  signature: string;
  sampleRate: number;
  processing: readonly (boolean | null)[];
};

export function comparison(first: Measurement, second: Measurement):
  { kind: 'different' } | { kind: 'silence' } | { kind: 'difference'; db: number } {
  if (!first.deviceId || first.deviceId !== second.deviceId || first.signature !== second.signature) {
    return { kind: 'different' };
  }
  if (first.dbfs === null || second.dbfs === null) return { kind: 'silence' };
  return { kind: 'difference', db: second.dbfs - first.dbfs };
}
