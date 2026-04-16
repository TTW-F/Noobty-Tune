import { describe, it } from "node:test";
import assert from "node:assert";
import { SimpleAudioQualityAnalyzer } from "./audioQualityAnalyzer";

describe("SimpleAudioQualityAnalyzer", () => {
  it("detects clipping in saturated signal", () => {
    const analyzer = new SimpleAudioQualityAnalyzer();
    const samples = new Float32Array(100).fill(0.99);

    const report = analyzer.analyze(samples);

    assert.strictEqual(report.isClipping, true);
    assert.ok(report.recommendation.includes("clipping"));
  });

  it("detects weak signal", () => {
    const analyzer = new SimpleAudioQualityAnalyzer();
    const samples = new Float32Array(100).fill(0.001);

    const report = analyzer.analyze(samples);

    assert.strictEqual(report.isWeak, true);
    assert.ok(report.recommendation.includes("weak"));
  });

  it("detects noisy signal with high zero crossing rate", () => {
    const analyzer = new SimpleAudioQualityAnalyzer();
    const samples = new Float32Array(100);

    // Create alternating signal (high ZCR)
    for (let i = 0; i < samples.length; i++) {
      samples[i] = i % 2 === 0 ? 0.5 : -0.5;
    }

    const report = analyzer.analyze(samples);

    assert.strictEqual(report.isNoisy, true);
    assert.ok(report.zeroCrossingRate > 0.3);
  });

  it("reports good quality for clean signal", () => {
    const analyzer = new SimpleAudioQualityAnalyzer();
    const samples = new Float32Array(100);

    // Create clean sine-like signal
    for (let i = 0; i < samples.length; i++) {
      samples[i] = 0.3 * Math.sin((i / 100) * Math.PI * 2);
    }

    const report = analyzer.analyze(samples);

    assert.strictEqual(report.isClipping, false);
    assert.strictEqual(report.isWeak, false);
    assert.ok(report.recommendation.includes("good"));
  });

  it("calculates RMS and peak levels correctly", () => {
    const analyzer = new SimpleAudioQualityAnalyzer();
    const samples = new Float32Array([0.5, -0.5, 0.3, -0.3]);

    const report = analyzer.analyze(samples);

    assert.strictEqual(report.peakLevel, 0.5);
    assert.ok(report.rmsLevel > 0);
    assert.ok(report.rmsLevel < report.peakLevel);
  });
});
