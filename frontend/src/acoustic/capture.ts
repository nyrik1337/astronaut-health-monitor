import workletUrl from './rms.worklet.js?url&no-inline';
import { levels, type Measurement } from './levels';

export type CaptureError = 'unsupported' | 'denied' | 'missingDevice' | 'unavailable' | 'stopped';
export type Capture = { result: Promise<Measurement>; stop: () => void };

export function supported(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext !== false
    && typeof navigator.mediaDevices?.getUserMedia === 'function'
    && typeof window.AudioContext === 'function' && typeof window.AudioWorkletNode === 'function';
}

function errorCode(error: unknown): CaptureError {
  // DOMException need not inherit from this realm's Error constructor.
  const name = error !== null && typeof error === 'object' && 'name' in error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'missingDevice';
  return 'unavailable';
}

/** Call only from an explicit user action. Never persist or transmit these results. */
export function startCapture(onProgress: (seconds: number) => void, deviceId?: string): Capture {
  let context: AudioContext | undefined;
  let stream: MediaStream | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let node: AudioWorkletNode | undefined;
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let resolve!: (measurement: Measurement) => void;
  let reject!: (code: CaptureError) => void;
  const result = new Promise<Measurement>((yes, no) => { resolve = yes; reject = no; });
  const stopTracks = (media: MediaStream) => media.getTracks().forEach((track) => {
    track.onended = null;
    track.onmute = null;
    track.stop();
  });
  const cleanup = () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', hidden);
    window.removeEventListener('pagehide', stop);
    if (stream) stopTracks(stream);
    if (node) {
      node.port.onmessage = null;
      node.onprocessorerror = null;
      node.port.close();
      node.disconnect();
    }
    source?.disconnect();
    if (context) {
      context.onstatechange = null;
      if (context.state !== 'closed') void context.close().catch(() => { /* Tracks are already stopped. */ });
    }
  };
  const fail = (code: CaptureError) => {
    if (finished) return;
    finished = true;
    cleanup();
    reject(code);
  };
  const stop = () => fail('stopped');
  const hidden = () => { if (document.hidden) stop(); };
  const setup = async () => {
    if (!supported()) { fail('unsupported'); return; }
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', stop);
    timer = setTimeout(() => fail('unavailable'), 30_000); // Includes unanswered permission prompts.
    try {
      // Create/resume while still in the user's click gesture; do not wait for permission first.
      context = new AudioContext();
      if (!context.audioWorklet) { fail('unsupported'); return; }
      const resumed = context.resume();
      void resumed.catch(() => fail('unavailable'));
      const available = navigator.mediaDevices.getSupportedConstraints?.() ?? {};
      const constraints: MediaTrackConstraints = {};
      if (available.echoCancellation) constraints.echoCancellation = false;
      if (available.noiseSuppression) constraints.noiseSuppression = false;
      if (available.autoGainControl) constraints.autoGainControl = false;
      if (available.channelCount) constraints.channelCount = { ideal: 1 };
      if (deviceId && available.deviceId) constraints.deviceId = { exact: deviceId };
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: constraints, video: false });
      // Permission can settle after Stop/unmount/timeout. Close late streams immediately.
      if (finished) { stopTracks(acquired); return; }
      stream = acquired;
      const track = stream.getAudioTracks()[0];
      if (!track || track.readyState !== 'live' || track.muted) { fail('unavailable'); return; }
      track.onended = () => fail('unavailable');
      track.onmute = () => fail('unavailable');
      await context.audioWorklet.addModule(workletUrl);
      if (finished) return;
      await resumed;
      if (finished) return;
      if (context.state !== 'running' || document.hidden) { fail('unavailable'); return; }
      const rate = context.sampleRate;
      const targetFrames = Math.round(rate * 10);
      const settings = track.getSettings();
      const processing = [settings.echoCancellation, settings.noiseSuppression, settings.autoGainControl]
        .map((value) => typeof value === 'boolean' ? value : null);
      const identity = settings.deviceId ?? '';
      const signature = JSON.stringify([identity, rate, settings.sampleRate, settings.channelCount, ...processing]);
      source = context.createMediaStreamSource(stream);
      node = new AudioWorkletNode(context, 'orbita-acoustic-rms', {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
        channelCount: 1, channelCountMode: 'explicit', processorOptions: { targetFrames },
      });
      node.onprocessorerror = () => fail('unavailable');
      node.port.onmessage = ({ data }: MessageEvent<unknown>) => {
        if (finished) return;
        const message = data as { type?: string; frames?: number; sumSquares?: number } | null;
        if (!message || !Number.isSafeInteger(message.frames) || (message.frames ?? -1) < 0
            || (message.frames ?? Infinity) > targetFrames) { fail('unavailable'); return; }
        if (message.type === 'progress') { onProgress(message.frames! / rate); return; }
        if (message.type !== 'complete' || message.frames !== targetFrames) { fail('unavailable'); return; }
        try {
          const value = levels(message.sumSquares!, message.frames);
          finished = true;
          cleanup();
          resolve({ ...value, deviceId: identity, signature, sampleRate: rate, processing });
        } catch { fail('unavailable'); }
      };
      context.onstatechange = () => { if (context?.state !== 'running') fail('unavailable'); };
      clearTimeout(timer);
      timer = setTimeout(() => fail('unavailable'), 15_000); // No partial result on a stalled graph.
      source.connect(node);
      node.connect(context.destination); // Processor emits silence, not microphone audio.
      onProgress(0);
    } catch (error) { fail(errorCode(error)); }
  };
  void setup();
  return { result, stop };
}
