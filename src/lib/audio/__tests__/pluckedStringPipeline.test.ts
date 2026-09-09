import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { YinPitchDetector } from "../pitchDetector";
import { extractPitchCandidate } from "../pitchCandidateExtractor";
import { ContinuousPitchTracker } from "../continuousPitchTracker";
import { TuningInterpreter } from "../../music/tuningInterpreter";
import type { TunerSelection } from "../../../types/tuner";

/**
 * End-to-end pipeline tests driven by synthesised plucked-string signals.
 *
 * Pure sines verify algorithm mechanics, but they never exercise the failure
 * modes that make a tuner unusable in the field: harmonic-rich tone, amplitude
 * decay, the attack pitch glide (tension modulation), and a heavily
 * attenuated fundamental. The generator below models all of them.
 */

const SAMPLE_RATE = 48000;
const FRAME_SIZE = 2048;
const FRAME_STEP = 2400; // 50ms cadence, matching the production loop

interface PluckConfig {
  baseFrequencyHz: number;
  durationSec: number;
  harmonics?: number;
  /** Scale of the n=1 partial; laptop mics attenuate it hard below ~150 Hz. */
  fundamentalGain?: number;
  attackGlideCents?: number;
  glideTauSec?: number;
  decaySec?: number;
  noiseLevel?: number;
}

function generatePluck(config: PluckConfig): {
  samples: Float32Array;
  frequencyAt: (timeSec: number) => number;
} {
  const harmonics = config.harmonics ?? 8;
  const fundamentalGain = config.fundamentalGain ?? 1;
  const attackGlideCents = config.attackGlideCents ?? 10;
  const glideTauSec = config.glideTauSec ?? 0.25;
  const decaySec = config.decaySec ?? 1.6;
  const noiseLevel = config.noiseLevel ?? 0.002;

  const totalSamples = Math.round(config.durationSec * SAMPLE_RATE);
  const samples = new Float32Array(totalSamples);
  const phases = new Float64Array(harmonics + 1);
  let seed = 7;

  let norm = 0;
  for (let n = 1; n <= harmonics; n += 1) {
    norm += 1 / n;
  }
  const scale = 0.25 / norm;

  for (let index = 0; index < totalSamples; index += 1) {
    const t = index / SAMPLE_RATE;
    const glideCents = attackGlideCents * Math.exp(-t / glideTauSec);
    const f0 = config.baseFrequencyHz * 2 ** (glideCents / 1200);

    let value = 0;
    for (let n = 1; n <= harmonics; n += 1) {
      const gain = (n === 1 ? fundamentalGain : 1 / n) * Math.exp(-t / (decaySec / n));
      phases[n] += (2 * Math.PI * n * f0) / SAMPLE_RATE;
      value += gain * Math.sin(phases[n]);
    }

    seed = (seed * 1664525 + 1013904223) % 4294967296;
    value += ((seed / 4294967296) * 2 - 1) * noiseLevel;

    samples[index] = value * scale;
  }

  return {
    samples,
    frequencyAt: (timeSec: number) =>
      config.baseFrequencyHz *
      2 ** ((attackGlideCents * Math.exp(-timeSec / glideTauSec)) / 1200),
  };
}

function runTunerPipeline(samples: Float32Array) {
  const detector = new YinPitchDetector({
    algorithm: "yin",
    probabilityThreshold: 0.82,
    clarityFloor: 0.35,
    minFrequencyHz: 70,
    maxFrequencyHz: 360,
    rmsThreshold: 0.008,
  });
  const tracker = new ContinuousPitchTracker();
  const interpreter = new TuningInterpreter();
  const selection: TunerSelection = { mode: "auto", targetId: null };

  const frames = [];
  for (let offset = 0; offset + FRAME_SIZE <= samples.length; offset += FRAME_STEP) {
    const timestampMs = Math.round((offset / SAMPLE_RATE) * 1000);
    const candidate = extractPitchCandidate(
      detector,
      samples.subarray(offset, offset + FRAME_SIZE),
      SAMPLE_RATE,
      timestampMs,
      "yin",
    );
    const tracked = tracker.update(candidate);
    const interpretation = interpreter.interpret(tracked, selection);
    frames.push({ timeSec: timestampMs / 1000, candidate, tracked, interpretation });
  }

  return frames;
}

function centsBetween(frequencyHz: number, referenceHz: number): number {
  return 1200 * Math.log2(frequencyHz / referenceHz);
}

describe("plucked-string pipeline", () => {
  it("locks on a real pluck model, tracks the glide, and holds through the sustain", () => {
    const pluck = generatePluck({
      baseFrequencyHz: 82.41, // low E string
      durationSec: 2.0,
      attackGlideCents: 12,
    });
    const frames = runTunerPipeline(pluck.samples);

    assert.ok(frames.length > 20);
    assert.equal(frames[0].tracked.stage, "acquiring");

    const lockFrame = frames.find((frame) => frame.tracked.stage === "locked");
    assert.ok(lockFrame, "never reached locked");
    assert.ok(lockFrame.timeSec <= 0.7, `lock took ${lockFrame.timeSec}s`);

    const lockedFrames = frames.filter((frame) => frame.tracked.stage === "locked");
    assert.ok(lockedFrames.length > 10, "lock did not hold through the sustain");
    assert.equal(frames.some((frame) => frame.tracked.stage === "lost"), false);

    // Steady-phase accuracy against the instantaneous true pitch (the attack
    // glide has settled by 0.8s).
    let maxErrorCents = 0;
    for (const frame of lockedFrames) {
      if (frame.timeSec < 0.8) {
        continue;
      }
      maxErrorCents = Math.max(
        maxErrorCents,
        Math.abs(centsBetween(frame.tracked.trackedFrequencyHz ?? 0, pluck.frequencyAt(frame.timeSec))),
      );
    }
    assert.ok(maxErrorCents <= 4, `steady-phase error ${maxErrorCents.toFixed(2)} cents`);

    // Auto targeting must pin the low E string for the whole sustain.
    for (const frame of lockedFrames) {
      assert.equal(frame.interpretation.targetId, "string-6");
    }
  });

  it("still reads the low E string when the mic attenuates its fundamental", () => {
    // Fundamental 16dB under the second harmonic: without octave correction
    // the pipeline locks an octave high (E3) on exactly this kind of signal.
    const pluck = generatePluck({
      baseFrequencyHz: 82.41,
      durationSec: 1.2,
      fundamentalGain: 0.15,
      attackGlideCents: 8,
    });
    const frames = runTunerPipeline(pluck.samples);

    const lockedFrames = frames.filter((frame) => frame.tracked.stage === "locked");
    assert.ok(lockedFrames.length > 5, "never reached locked");

    for (const frame of lockedFrames) {
      const cents = centsBetween(frame.tracked.trackedFrequencyHz ?? 0, 82.41);
      assert.ok(
        Math.abs(cents) < 25,
        `tracked ${cents.toFixed(0)} cents away from E2 (octave error?)`,
      );
      assert.equal(frame.interpretation.targetId, "string-6");
    }
  });
});
