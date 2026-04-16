/**
 * Performance monitoring utility for audio processing pipeline
 * Tracks frame processing time, detection latency, and throughput
 */

export interface PerformanceMetrics {
  readonly averageFrameTimeMs: number;
  readonly maxFrameTimeMs: number;
  readonly minFrameTimeMs: number;
  readonly framesProcessed: number;
  readonly droppedFrames: number;
  readonly throughputFps: number;
  readonly lastUpdateTimestamp: number;
}

export interface PerformanceMonitor {
  recordFrameStart(): void;
  recordFrameEnd(): void;
  recordDroppedFrame(): void;
  getMetrics(): PerformanceMetrics;
  reset(): void;
}

export class AudioPerformanceMonitor implements PerformanceMonitor {
  private frameStartTime = 0;
  private frameTimes: number[] = [];
  private framesProcessed = 0;
  private droppedFrames = 0;
  private lastResetTime = performance.now();
  private readonly maxHistorySize: number;

  constructor(maxHistorySize = 100) {
    this.maxHistorySize = maxHistorySize;
  }

  recordFrameStart(): void {
    this.frameStartTime = performance.now();
  }

  recordFrameEnd(): void {
    if (this.frameStartTime === 0) {
      return;
    }

    const frameTime = performance.now() - this.frameStartTime;
    this.frameTimes.push(frameTime);
    this.framesProcessed += 1;

    if (this.frameTimes.length > this.maxHistorySize) {
      this.frameTimes.shift();
    }

    this.frameStartTime = 0;
  }

  recordDroppedFrame(): void {
    this.droppedFrames += 1;
  }

  getMetrics(): PerformanceMetrics {
    const now = performance.now();
    const elapsedSeconds = (now - this.lastResetTime) / 1000;

    if (this.frameTimes.length === 0) {
      return {
        averageFrameTimeMs: 0,
        maxFrameTimeMs: 0,
        minFrameTimeMs: 0,
        framesProcessed: this.framesProcessed,
        droppedFrames: this.droppedFrames,
        throughputFps: elapsedSeconds > 0 ? this.framesProcessed / elapsedSeconds : 0,
        lastUpdateTimestamp: now,
      };
    }

    const sum = this.frameTimes.reduce((acc, time) => acc + time, 0);
    const average = sum / this.frameTimes.length;
    const max = Math.max(...this.frameTimes);
    const min = Math.min(...this.frameTimes);

    return {
      averageFrameTimeMs: average,
      maxFrameTimeMs: max,
      minFrameTimeMs: min,
      framesProcessed: this.framesProcessed,
      droppedFrames: this.droppedFrames,
      throughputFps: elapsedSeconds > 0 ? this.framesProcessed / elapsedSeconds : 0,
      lastUpdateTimestamp: now,
    };
  }

  reset(): void {
    this.frameTimes = [];
    this.framesProcessed = 0;
    this.droppedFrames = 0;
    this.lastResetTime = performance.now();
    this.frameStartTime = 0;
  }
}
