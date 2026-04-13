import type { AudioFrame } from "../../types/tuner";

export interface TimeDomainFrameCaptureOptions {
  readonly fftSize?: number;
  readonly smoothingTimeConstant?: number;
}

export interface TimeDomainFrameCapture {
  readFrame(timestampMs?: number): AudioFrame;
  dispose(): void;
}

export class AnalyserTimeDomainFrameCapture implements TimeDomainFrameCapture {
  private readonly analyserNode: AnalyserNode;
  private readonly buffer: Float32Array<ArrayBuffer>;

  constructor(sourceNode: AudioNode, options: TimeDomainFrameCaptureOptions = {}) {
    const audioContext = sourceNode.context;
    this.analyserNode = audioContext.createAnalyser();
    this.analyserNode.fftSize = options.fftSize ?? 2048;
    this.analyserNode.smoothingTimeConstant = options.smoothingTimeConstant ?? 0.05;
    sourceNode.connect(this.analyserNode);
    this.buffer = new Float32Array(new ArrayBuffer(this.analyserNode.fftSize * Float32Array.BYTES_PER_ELEMENT));
  }

  readFrame(timestampMs = performance.now()): AudioFrame {
    this.analyserNode.getFloatTimeDomainData(this.buffer);

    let squaredSum = 0;
    let peak = 0;

    for (let index = 0; index < this.buffer.length; index += 1) {
      const sample = this.buffer[index];
      squaredSum += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
    }

    return {
      samples: Float32Array.from(this.buffer),
      sampleRate: this.analyserNode.context.sampleRate,
      timestampMs,
      rms: Math.sqrt(squaredSum / this.buffer.length),
      peak,
    };
  }

  dispose(): void {
    this.analyserNode.disconnect();
  }
}
