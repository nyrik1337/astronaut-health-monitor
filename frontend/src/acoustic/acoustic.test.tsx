import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { LiveAcousticCheck } from './LiveAcousticCheck';
import { startCapture } from './capture';
import { comparison, levels, type Measurement } from './levels';
import { acousticEnglish as text } from './messages';
import processorCode from './rms.worklet.js?raw';

const contexts: FakeContext[] = [];
const nodes: FakeNode[] = [];
type FakeTrack = { readyState: string; muted: boolean; onended: (() => void) | null; onmute: (() => void) | null;
  stop: ReturnType<typeof vi.fn>; getSettings: () => MediaTrackSettings };
const tracks: FakeTrack[] = [];
const supportedConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: true, deviceId: true };
let getUserMedia = vi.fn();
let settings: MediaTrackSettings;

function makeTrack(): FakeTrack {
  const track = {
    readyState: 'live', muted: false, onended: null as (() => void) | null, onmute: null as (() => void) | null,
    stop: vi.fn(() => { track.readyState = 'ended'; }), getSettings: () => settings,
  };
  tracks.push(track);
  return track;
}
function makeStream() {
  const track = makeTrack();
  return { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
}
class FakeContext {
  state = 'running';
  sampleRate = 48_000;
  destination = {};
  onstatechange: (() => void) | null = null;
  audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
  source = { connect: vi.fn(), disconnect: vi.fn() };
  createMediaStreamSource = vi.fn(() => this.source);
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn(async () => { this.state = 'closed'; });
  constructor() { contexts.push(this); }
}
class FakeNode {
  port = { onmessage: null as ((event: MessageEvent) => void) | null, close: vi.fn() };
  onprocessorerror: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  constructor() { nodes.push(this); }
  emit(data: unknown) { this.port.onmessage?.({ data } as MessageEvent); }
}

beforeEach(() => {
  contexts.length = 0; nodes.length = 0; tracks.length = 0;
  settings = { deviceId: 'mic-a', sampleRate: 48_000, channelCount: 1,
    echoCancellation: false, noiseSuppression: false, autoGainControl: false };
  getUserMedia = vi.fn().mockImplementation(async () => makeStream());
  vi.stubGlobal('AudioContext', FakeContext);
  vi.stubGlobal('AudioWorkletNode', FakeNode);
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia, getSupportedConstraints: () => supportedConstraints } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

async function ready() { await waitFor(() => expect(nodes.length).toBeGreaterThan(0)); }
function complete(rms = 0.5) { nodes.at(-1)!.emit({ type: 'complete', frames: 480_000, sumSquares: rms * rms * 480_000 }); }
function measurement(rms: number, deviceId = 'mic-a'): Measurement {
  return { ...levels(rms * rms * 4, 4), deviceId, signature: deviceId, sampleRate: 48_000, processing: [false, false, false] };
}

test('RMS and dBFS use squared samples and amplitude reference 1.0', () => {
  const values = [1, -1, 0, 0];
  const result = levels(values.reduce((sum, value) => sum + value * value, 0), values.length);
  expect(result.rms).toBeCloseTo(Math.SQRT1_2);
  expect(result.dbfs).toBeCloseTo(-3.0103);
  expect(levels(4, 4)).toEqual({ rms: 1, dbfs: 0 });
  expect(levels(1, 4).dbfs).toBeCloseTo(-6.0206);
  expect(levels(0, 4)).toEqual({ rms: 0, dbfs: null });
  expect(() => levels(0, 0)).toThrow();
  expect(() => levels(NaN, 4)).toThrow();
});

test('comparison requires the same reported device and settings; silence has no finite delta', () => {
  expect(comparison(measurement(0.5), measurement(1))).toEqual({ kind: 'difference', db: expect.closeTo(6.0206) });
  expect(comparison(measurement(0), measurement(0))).toEqual({ kind: 'silence' });
  expect(comparison(measurement(0.5), measurement(0))).toEqual({ kind: 'silence' });
  expect(comparison(measurement(0.5), measurement(0.5, 'mic-b'))).toEqual({ kind: 'different' });
  expect(comparison(measurement(0.5, ''), measurement(0.5, ''))).toEqual({ kind: 'different' });
  expect(comparison(measurement(0.5), { ...measurement(0.5), signature: 'gain-changed' })).toEqual({ kind: 'different' });
});

test('worklet processes consecutive blocks exactly once, clips only the final block length, and posts no raw samples', () => {
  type Processor = { process: (inputs: Float32Array[][]) => boolean; port: { postMessage: ReturnType<typeof vi.fn> } };
  let Processor!: new (options: { processorOptions: { targetFrames: number } }) => Processor;
  class Base { port = { postMessage: vi.fn() }; }
  new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', processorCode)(
    Base, (_name: string, ctor: typeof Processor) => { Processor = ctor; }, 4,
  );
  const processor = new Processor({ processorOptions: { targetFrames: 4 } });
  expect(processor.process([[new Float32Array([0.5, -0.5, 0.5])]])).toBe(true);
  expect(processor.process([[new Float32Array([-0.5, 1, 1])]])).toBe(false);
  expect(processor.port.postMessage).toHaveBeenLastCalledWith({ type: 'complete', frames: 4, sumSquares: 1 });
  expect(processor.process([[new Float32Array([1])]])).toBe(false);
  const silence = new Processor({ processorOptions: { targetFrames: 4 } });
  silence.process([[new Float32Array(4)]]);
  expect(silence.port.postMessage).toHaveBeenLastCalledWith({ type: 'complete', frames: 4, sumSquares: 0 });
  const interrupted = new Processor({ processorOptions: { targetFrames: 4 } });
  interrupted.process([[new Float32Array([0.2])]]);
  expect(interrupted.process([[]])).toBe(false);
  expect(interrupted.port.postMessage).toHaveBeenLastCalledWith({ type: 'error' });
});

test('permission denial closes context and returns a specific error', async () => {
  getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
  const capture = startCapture(vi.fn());
  await expect(capture.result).rejects.toBe('denied');
  expect(contexts[0]!.close).toHaveBeenCalledOnce();
});

test.each([['NotFoundError', 'missingDevice'], ['NotReadableError', 'unavailable']])('handles %s', async (name, code) => {
  getUserMedia.mockRejectedValueOnce(new DOMException('input unavailable', name));
  await expect(startCapture(vi.fn()).result).rejects.toBe(code);
  expect(contexts[0]!.close).toHaveBeenCalledOnce();
});

test('successful capture requests processing off, counts 10 seconds, and releases every resource', async () => {
  const progress = vi.fn();
  const capture = startCapture(progress, 'mic-a');
  await ready();
  expect(getUserMedia).toHaveBeenCalledWith({ audio: { echoCancellation: false, noiseSuppression: false,
    autoGainControl: false, channelCount: { ideal: 1 }, deviceId: { exact: 'mic-a' } }, video: false });
  nodes[0]!.emit({ type: 'progress', frames: 240_000 });
  expect(progress).toHaveBeenLastCalledWith(5);
  complete();
  expect(await capture.result).toMatchObject({ rms: 0.5, dbfs: expect.closeTo(-6.0206), deviceId: 'mic-a' });
  expect(tracks[0]!.stop).toHaveBeenCalledOnce();
  expect(nodes[0]!.disconnect).toHaveBeenCalledOnce();
  expect(nodes[0]!.port.close).toHaveBeenCalledOnce();
  expect(contexts[0]!.source.disconnect).toHaveBeenCalledOnce();
  expect(contexts[0]!.close).toHaveBeenCalledOnce();
});

test('Stop cancels permission wait and stops a stream arriving after cancellation', async () => {
  let permit!: (stream: MediaStream) => void;
  getUserMedia.mockReturnValueOnce(new Promise<MediaStream>((resolve) => { permit = resolve; }));
  const capture = startCapture(vi.fn());
  const rejected = expect(capture.result).rejects.toBe('stopped');
  capture.stop();
  await rejected;
  expect(contexts[0]!.close).toHaveBeenCalledOnce();
  permit(makeStream());
  await waitFor(() => expect(tracks[0]!.stop).toHaveBeenCalledOnce());
  expect(nodes).toHaveLength(0);
});

test.each(['stop', 'track', 'processor', 'context', 'pagehide', 'bad-result'])('%s releases active resources without partial results', async (event) => {
  const capture = startCapture(vi.fn());
  const rejected = expect(capture.result).rejects.toBe(event === 'stop' || event === 'pagehide' ? 'stopped' : 'unavailable');
  await ready();
  if (event === 'stop') capture.stop();
  if (event === 'track') tracks[0]!.onended?.();
  if (event === 'processor') nodes[0]!.onprocessorerror?.();
  if (event === 'context') { contexts[0]!.state = 'suspended'; contexts[0]!.onstatechange?.(); }
  if (event === 'pagehide') window.dispatchEvent(new Event('pagehide'));
  if (event === 'bad-result') nodes[0]!.emit({ type: 'complete', frames: 4, sumSquares: 1 });
  await rejected;
  expect(tracks[0]!.stop).toHaveBeenCalledOnce();
  expect(contexts[0]!.close).toHaveBeenCalledOnce();
});

test('unanswered permission timeout is bounded and late tracks still stop', async () => {
  vi.useFakeTimers();
  let permit!: (stream: MediaStream) => void;
  getUserMedia.mockReturnValueOnce(new Promise<MediaStream>((resolve) => { permit = resolve; }));
  const capture = startCapture(vi.fn());
  const rejected = expect(capture.result).rejects.toBe('unavailable');
  await vi.advanceTimersByTimeAsync(30_000);
  await rejected;
  permit(makeStream());
  await Promise.resolve();
  expect(tracks[0]!.stop).toHaveBeenCalledOnce();
  expect(contexts[0]!.close).toHaveBeenCalledOnce();
});

test('failure while loading the processor releases an already acquired microphone', async () => {
  let permit!: (stream: MediaStream) => void;
  getUserMedia.mockReturnValueOnce(new Promise<MediaStream>((resolve) => { permit = resolve; }));
  const capture = startCapture(vi.fn());
  const rejected = expect(capture.result).rejects.toBe('unavailable');
  contexts[0]!.audioWorklet.addModule.mockRejectedValueOnce(new Error('module unavailable'));
  permit(makeStream());
  await rejected;
  expect(tracks[0]!.stop).toHaveBeenCalledOnce();
  expect(contexts[0]!.close).toHaveBeenCalledOnce();
});

test('a graph with no sample messages times out without turning missing audio into silence', async () => {
  vi.useFakeTimers();
  const stalled = startCapture(vi.fn());
  const timedOut = expect(stalled.result).rejects.toBe('unavailable');
  await vi.advanceTimersByTimeAsync(0);
  expect(nodes).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(15_001);
  await timedOut;
  expect(tracks[0]!.stop).toHaveBeenCalledOnce();
  expect(contexts[0]!.close).toHaveBeenCalledOnce();
});

test('hiding the browser tab cancels measurement', async () => {
  const capture = startCapture(vi.fn());
  const rejected = expect(capture.result).rejects.toBe('stopped');
  await ready();
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  document.dispatchEvent(new Event('visibilitychange'));
  await rejected;
  hidden.mockRestore();
  expect(tracks[0]!.stop).toHaveBeenCalledOnce();
});

test('unmount while permission is pending stops the subsequently granted microphone', async () => {
  let permit!: (stream: MediaStream) => void;
  getUserMedia.mockReturnValueOnce(new Promise<MediaStream>((resolve) => { permit = resolve; }));
  const view = render(<LiveAcousticCheck />);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: text.start }));
  view.unmount();
  expect(contexts[0]!.close).toHaveBeenCalledOnce();
  await act(async () => { permit(makeStream()); });
  expect(tracks[0]!.stop).toHaveBeenCalledOnce();
  expect(nodes).toHaveLength(0);
});

test('unsupported browser fallback never requests a microphone', () => {
  vi.stubGlobal('AudioWorkletNode', undefined);
  render(<LiveAcousticCheck />);
  expect(screen.getByRole('status')).toHaveTextContent(text.unsupported);
  expect(screen.getByRole('button', { name: text.start })).toBeDisabled();
  expect(getUserMedia).not.toHaveBeenCalled();
});

test('explicit consent and Start are required; two results compare and Clear removes them', async () => {
  render(<LiveAcousticCheck />);
  const start = screen.getByRole('button', { name: text.start });
  expect(start).toBeDisabled();
  expect(getUserMedia).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox'));
  expect(getUserMedia).not.toHaveBeenCalled();
  fireEvent.click(start);
  await ready();
  act(() => complete(0.5));
  await screen.findByText(text.done);
  fireEvent.click(start);
  await waitFor(() => expect(nodes).toHaveLength(2));
  act(() => complete(1));
  await screen.findByText(`${text.compare}: 6.02 dB`);
  expect(screen.getByText(text.previous)).toBeInTheDocument();
  expect(getUserMedia.mock.calls[1]![0].audio.deviceId).toEqual({ exact: 'mic-a' });
  fireEvent.click(screen.getByRole('button', { name: text.clear }));
  expect(screen.queryByText(text.latest)).toBeNull();
  expect(screen.getByText(text.waitingComparison)).toBeInTheDocument();
});

test.each(['unmount', 'inactive'])('%s closes active capture', async (event) => {
  const view = render(<LiveAcousticCheck />);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: text.start }));
  await ready();
  if (event === 'unmount') view.unmount();
  else view.rerender(<LiveAcousticCheck active={false} />);
  expect(tracks[0]!.stop).toHaveBeenCalledOnce();
  expect(contexts[0]!.close).toHaveBeenCalledOnce();
});

test('component shows digital silence and permission denial without numerical substitution', async () => {
  render(<LiveAcousticCheck messages={{ title: 'Localized title' }} />);
  expect(screen.getByRole('heading', { name: 'Localized title' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: text.start }));
  await ready();
  act(() => complete(0));
  await screen.findByText(text.silence);
  getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
  fireEvent.click(screen.getByRole('button', { name: text.start }));
  await screen.findByText(text.denied);
  expect(screen.getByText(text.silence)).toBeInTheDocument();
});
