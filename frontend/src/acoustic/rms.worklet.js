/* Runs only in AudioWorkletGlobalScope. Raw blocks never leave this processor. */
class OrbitaRmsProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.target = options.processorOptions.targetFrames;
    this.frames = 0;
    this.sumSquares = 0;
    this.lastReport = 0;
    this.finished = false;
  }

  process(inputs) {
    if (this.finished) return false;
    const samples = inputs[0]?.[0]; // The node explicitly downmixes to mono.
    if (!samples?.length) {
      if (this.frames > 0) {
        this.port.postMessage({ type: 'error' });
        this.finished = true;
        return false;
      }
      return true; // Startup without a connected input is bounded by the main-thread watchdog.
    }
    const count = Math.min(samples.length, this.target - this.frames);
    for (let i = 0; i < count; i += 1) {
      if (!Number.isFinite(samples[i])) {
        this.port.postMessage({ type: 'error' });
        this.finished = true;
        return false;
      }
      this.sumSquares += samples[i] * samples[i];
    }
    this.frames += count;
    if (this.frames === this.target) {
      this.port.postMessage({ type: 'complete', frames: this.frames, sumSquares: this.sumSquares });
      this.finished = true;
      return false;
    }
    if (this.frames - this.lastReport >= sampleRate / 4) {
      this.port.postMessage({ type: 'progress', frames: this.frames });
      this.lastReport = this.frames;
    }
    // Output buffers remain zero: never play the microphone through the speakers.
    return true;
  }
}
registerProcessor('orbita-acoustic-rms', OrbitaRmsProcessor);
