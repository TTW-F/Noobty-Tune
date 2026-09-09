import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AutoCorrelationPitchDetector,
  YinPitchDetector,
} from "../pitchDetector";

const SAMPLE_RATE = 48000;
const SAMPLE_COUNT = 2048;

function generateSine(
  frequencyHz: number,
  amplitude = 0.5,
  sampleCount = SAMPLE_COUNT,
): Float32Array {
  const samples = new Float32Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = amplitude * Math.sin((2 * Math.PI * frequencyHz * index) / SAMPLE_RATE);
  }

  return samples;
}

function generateNoisySine(
  frequencyHz: number,
  amplitude: number,
  noiseAmplitude: number,
  sampleCount = SAMPLE_COUNT,
): Float32Array {
  const samples = new Float32Array(sampleCount);
  let seed = 42;

  for (let index = 0; index < sampleCount; index += 1) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const noise = (seed / 4294967296) * 2 - 1;
    samples[index] = amplitude * Math.sin((2 * Math.PI * frequencyHz * index) / SAMPLE_RATE) + noiseAmplitude * noise;
  }

  return samples;
}

function createPrimaryDetector(clarityFloor = 0.35): YinPitchDetector {
  return new YinPitchDetector({
    algorithm: "yin",
    probabilityThreshold: 0.82,
    clarityFloor,
    minFrequencyHz: 70,
    maxFrequencyHz: 360,
    rmsThreshold: 0.008,
  });
}

describe("YinPitchDetector", () => {
  const detector = createPrimaryDetector();

  it("detects the low E string with high clarity", () => {
    const reading = detector.detect(generateSine(82.41), SAMPLE_RATE);

    assert.ok(reading);
    assert.ok(Math.abs(reading.frequencyHz - 82.41) < 0.5);
    assert.ok(reading.clarity > 0.9);
  });

  it("detects the high E string", () => {
    const reading = detector.detect(generateSine(329.63), SAMPLE_RATE);

    assert.ok(reading);
    assert.ok(Math.abs(reading.frequencyHz - 329.63) < 0.5);
  });

  it("reports noisy frames with their honest clarity instead of dropping them", () => {
    const noisy = generateNoisySine(110, 0.5, 0.12);

    const strict = createPrimaryDetector(0.99);
    assert.equal(strict.detect(noisy, SAMPLE_RATE), null);

    const reading = detector.detect(noisy, SAMPLE_RATE);
    assert.ok(reading);
    assert.ok(Math.abs(reading.frequencyHz - 110) < 2);
  });

  it("drops silence", () => {
    assert.equal(detector.detect(new Float32Array(SAMPLE_COUNT), SAMPLE_RATE), null);
  });

  it("corrects octave-up reads when the fundamental is heavily attenuated", () => {
    // Laptop mics roll off below ~150 Hz; on the low E string the second
    // harmonic then dominates and the first CMND valley sits at tau0/2. The
    // octave guard must double the lag because the tau0 valley is far deeper.
    const samples = new Float32Array(SAMPLE_COUNT);
    const f0 = 82.41;

    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      const t = index / SAMPLE_RATE;
      samples[index] =
        0.15 * Math.sin(2 * Math.PI * f0 * t) +
        1.0 * Math.sin(4 * Math.PI * f0 * t);
    }

    const reading = detector.detect(samples, SAMPLE_RATE);

    assert.ok(reading);
    assert.ok(Math.abs(reading.frequencyHz - f0) < 0.5);
  });

  it("rejects pitches whose period is unsearchable and folds others onto range", () => {
    const strict = createPrimaryDetector(0.99);

    // 50 Hz has its period (and multiples) entirely outside the lag range.
    assert.equal(strict.detect(generateSine(50), SAMPLE_RATE), null);

    // 440 Hz cannot be searched directly (tau0 below minTau), so the detector
    // reports the nearest searchable period (220 Hz) instead of inventing a
    // value above the ceiling. Real guitar fundamentals always keep tau0
    // inside the range, so this folding only affects out-of-model inputs.
    const reading = strict.detect(generateSine(440), SAMPLE_RATE);
    assert.ok(reading);
    assert.ok(reading.frequencyHz <= 360);
    assert.ok(Math.abs(reading.frequencyHz - 220) < 1);
  });
});

describe("AutoCorrelationPitchDetector", () => {
  it("picks the fundamental rather than a multiple of the period", () => {
    // The sub-octave lag (2*tau0) must stay inside the search range so the
    // first-peak rule is actually exercised against the global-maximum rule.
    const detector = new AutoCorrelationPitchDetector({
      algorithm: "autocorrelation",
      minFrequencyHz: 40,
      maxFrequencyHz: 360,
      clarityFloor: 0.3,
      rmsThreshold: 0.008,
    });

    const reading = detector.detect(generateSine(82.41), SAMPLE_RATE);

    assert.ok(reading);
    assert.ok(Math.abs(reading.frequencyHz - 82.41) < 0.5);
  });
});
