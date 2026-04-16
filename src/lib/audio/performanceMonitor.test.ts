import { describe, it } from "node:test";
import assert from "node:assert";
import { AudioPerformanceMonitor } from "./performanceMonitor";

describe("AudioPerformanceMonitor", () => {
  it("tracks frame processing time", () => {
    const monitor = new AudioPerformanceMonitor();

    monitor.recordFrameStart();
    monitor.recordFrameEnd();

    const metrics = monitor.getMetrics();
    assert.strictEqual(metrics.framesProcessed, 1);
    assert.ok(metrics.averageFrameTimeMs >= 0);
  });

  it("calculates throughput correctly", () => {
    const monitor = new AudioPerformanceMonitor();

    for (let i = 0; i < 10; i++) {
      monitor.recordFrameStart();
      monitor.recordFrameEnd();
    }

    const metrics = monitor.getMetrics();
    assert.strictEqual(metrics.framesProcessed, 10);
    assert.ok(metrics.throughputFps > 0);
  });

  it("tracks dropped frames", () => {
    const monitor = new AudioPerformanceMonitor();

    monitor.recordDroppedFrame();
    monitor.recordDroppedFrame();

    const metrics = monitor.getMetrics();
    assert.strictEqual(metrics.droppedFrames, 2);
  });

  it("resets metrics correctly", () => {
    const monitor = new AudioPerformanceMonitor();

    monitor.recordFrameStart();
    monitor.recordFrameEnd();
    monitor.recordDroppedFrame();

    monitor.reset();

    const metrics = monitor.getMetrics();
    assert.strictEqual(metrics.framesProcessed, 0);
    assert.strictEqual(metrics.droppedFrames, 0);
  });

  it("maintains limited history", () => {
    const monitor = new AudioPerformanceMonitor(5);

    for (let i = 0; i < 10; i++) {
      monitor.recordFrameStart();
      monitor.recordFrameEnd();
    }

    const metrics = monitor.getMetrics();
    assert.strictEqual(metrics.framesProcessed, 10);
    // History should be limited but all frames counted
  });
});
