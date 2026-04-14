import test from "node:test";
import assert from "node:assert/strict";
import { RollingPitchStabilizer } from "./pitchStabilizer";
import { getStandardTuningTarget } from "../music";
import type { PitchReading } from "../../types/tuner";

function createReading(
  frequencyHz: number,
  timestampMs: number,
  clarity = 0.95,
  rms = 0.02,
): PitchReading {
  return {
    frequencyHz,
    clarity,
    timestampMs,
    source: "microphone",
    rms,
  };
}

test("stabilizer returns stable output after enough close readings", () => {
  const stabilizer = new RollingPitchStabilizer({
    requiredSamples: 3,
    centsTolerance: 12,
    clarityThreshold: 0.8,
  });

  stabilizer.push(createReading(109.8, 1));
  stabilizer.push(createReading(110.2, 2));
  const result = stabilizer.push(createReading(110.1, 3));

  assert.ok(result);
  assert.equal(result!.stable, true);
  assert.equal(result!.sampleCount, 3);
  assert.equal(result!.target?.id, "string-5");
  assert.ok(Math.abs(result!.frequencyHz - 110) < 0.3);
});

test("stabilizer resets when clarity drops below threshold", () => {
  const stabilizer = new RollingPitchStabilizer({
    requiredSamples: 3,
    clarityThreshold: 0.8,
  });

  stabilizer.push(createReading(110, 1));
  const lowClarity = stabilizer.push(createReading(110, 2, 0.4));
  const next = stabilizer.push(createReading(110, 3));

  assert.equal(lowClarity, null);
  assert.ok(next);
  assert.equal(next!.sampleCount, 1);
  assert.equal(next!.stable, false);
});

test("stabilizer honors a manual target hint instead of auto-closest target", () => {
  const stabilizer = new RollingPitchStabilizer({
    requiredSamples: 2,
    centsTolerance: 20,
    clarityThreshold: 0.8,
  });
  const manualHighE = getStandardTuningTarget("string-1");

  stabilizer.push(createReading(329.4, 1), manualHighE);
  const result = stabilizer.push(createReading(329.8, 2), manualHighE);

  assert.ok(result);
  assert.equal(result!.target?.id, "string-1");
  assert.equal(result!.noteName, "E");
  assert.equal(result!.octave, 4);
  assert.equal(result!.stable, true);
});

test("stabilizer marks wide pitch spread as unstable", () => {
  const stabilizer = new RollingPitchStabilizer({
    requiredSamples: 3,
    centsTolerance: 5,
    clarityThreshold: 0.8,
  });

  stabilizer.push(createReading(82.41, 1));
  stabilizer.push(createReading(84.2, 2));
  const result = stabilizer.push(createReading(81.7, 3));

  assert.ok(result);
  assert.equal(result!.stable, false);
});
