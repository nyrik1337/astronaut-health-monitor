import { useEffect, useId, useRef, useState } from 'react';
import { startCapture, supported, type Capture, type CaptureError } from './capture';
import { comparison, type Measurement } from './levels';
import { acousticEnglish, type AcousticMessages } from './messages';
import './acoustic.css';

export type LiveAcousticCheckProps = {
  /** Set false when hiding a mounted panel; unmounting also stops capture. */
  active?: boolean;
  messages?: Partial<AcousticMessages>;
  locale?: string;
};

export function LiveAcousticCheck({ active = true, messages, locale = 'en' }: LiveAcousticCheckProps) {
  const text = { ...acousticEnglish, ...messages };
  const titleId = useId();
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'measuring' | 'done' | CaptureError>('idle');
  const [seconds, setSeconds] = useState(0);
  const [results, setResults] = useState<Measurement[]>([]);
  const current = useRef<Capture | null>(null);
  const busy = status === 'requesting' || status === 'measuring';
  const available = supported();
  const number = (value: number, digits: number) => value.toLocaleString(locale, { maximumFractionDigits: digits });

  const stop = () => {
    const capture = current.current;
    current.current = null;
    capture?.stop();
    if (capture) setStatus('stopped');
  };
  useEffect(() => () => {
    const capture = current.current;
    current.current = null;
    capture?.stop();
  }, []);
  useEffect(() => { if (!active) stop(); }, [active]);

  const start = () => {
    if (!consent || !active || !available || current.current) return;
    setStatus('requesting');
    setSeconds(0);
    const capture = startCapture((elapsed) => { setStatus('measuring'); setSeconds(elapsed); }, results.at(-1)?.deviceId);
    current.current = capture;
    void capture.result.then((value) => {
      if (current.current !== capture) return;
      current.current = null;
      setResults((previous) => [...previous, value].slice(-2));
      setStatus('done');
      setSeconds(10);
    }).catch((error: CaptureError) => {
      if (current.current !== capture) return;
      current.current = null;
      setStatus(error);
    });
  };
  const delta = results.length === 2 ? comparison(results[0]!, results[1]!) : null;

  return <section className="orbita-acoustic" aria-labelledby={titleId}>
    <h2 id={titleId}>{text.title}</h2>
    <p><strong>{text.notice}</strong></p>
    <p>{text.privacy}</p><p>{text.limits}</p><p>{text.processing}</p>
    <label className="orbita-acoustic__consent">
      <input type="checkbox" checked={consent} disabled={busy} onChange={(event) => setConsent(event.target.checked)} />
      {text.consent}
    </label>
    <div className="orbita-acoustic__actions">
      <button type="button" onClick={start} disabled={!consent || !active || !available || busy}>{text.start}</button>
      <button type="button" onClick={stop} disabled={!busy}>{text.stop}</button>
      <button type="button" disabled={busy} onClick={() => { setResults([]); setStatus('idle'); setSeconds(0); }}>{text.clear}</button>
    </div>
    <p role="status">{available ? text[status] : text.unsupported}</p>
    {status === 'measuring' && <div>
      <progress max={10} value={seconds} aria-label={text.measuring} /> {number(seconds, 1)} / 10 {text.secondsUnit}
    </div>}
    {results.length > 0 && <div aria-label={text.results} className="orbita-acoustic__results">
      {results.map((value, index) => <article key={index}>
        <h3>{index === results.length - 1 ? text.latest : text.previous}</h3>
        <dl>
          <dt>{text.rms}</dt><dd>{value.rms.toLocaleString(locale, { maximumSignificantDigits: 6 })}</dd>
          <dt>{text.dbfs}</dt><dd>{value.dbfs === null ? text.silence : `${number(value.dbfs, 2)} ${text.dbfsUnit}`}</dd>
          <dt>{text.rate}</dt><dd>{number(value.sampleRate, 0)}</dd>
          {[text.echo, text.noise, text.gain].map((label, i) => <div key={label}>
            <dt>{label}</dt><dd>{value.processing[i] === null ? text.unknown : value.processing[i] ? text.on : text.off}</dd>
          </div>)}
        </dl>
      </article>)}
    </div>}
    <p>{delta === null ? text.waitingComparison : delta.kind === 'different' ? text.different
      : delta.kind === 'silence' ? text.silentComparison : `${text.compare}: ${number(delta.db, 2)} ${text.differenceUnit}`}</p>
    <p>{text.compareNote}</p>
  </section>;
}
