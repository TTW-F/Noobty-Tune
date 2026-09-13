import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TUNER_SELECTION,
  createListeningState,
  createPermissionDeniedState,
  resolveActiveTarget,
  resolveDeviation,
} from "./tunerState";
import { STANDARD_TUNING_TARGETS } from "../../../lib/music";
import type {
  PitchReading,
  StabilizedPitchReading,
  TunerEngineError,
  TuningStringId,
  TuningTarget,
} from "../../../types/tuner";

const TARGETS = STANDARD_TUNING_TARGETS;

function findTarget(targetId: TuningStringId): TuningTarget {
  const target = TARGETS.find((item) => item.id === targetId);
  assert.ok(target, `missing target ${targetId}`);
  return target;
}

function createReading(frequencyHz: number): PitchReading {
  return {
    frequencyHz,
    clarity: 0.95,
    timestampMs: 1,
    source: "microphone",
  };
}

function createStableReading(frequencyHz: number, targetId: TuningStringId): StabilizedPitchReading {
  const target = findTarget(targetId);
  return {
    frequencyHz,
    clarity: 0.95,
    timestampMs: 1,
    source: "microphone",
    stable: true,
    sampleCount: 3,
    target,
    noteName: target.note,
    octave: target.octave,
    cents: 0,
  };
}

test("createListeningState keeps listening defaults while allowing optional readings", () => {
  const state = createListeningState();

  assert.equal(state.audioStatus, "listening");
  assert.equal(state.uiStatus, "listening");
  assert.deepEqual(state.selection, DEFAULT_TUNER_SELECTION);
  assert.equal(state.detectedPitch, null);
});

test("createPermissionDeniedState preserves denial error information", () => {
  const error: TunerEngineError = {
    code: "NotAllowedError",
    message: "blocked",
    recoverable: true,
  };

  const state = createPermissionDeniedState(error);

  assert.equal(state.audioStatus, "permission-denied");
  assert.equal(state.uiStatus, "permission-denied");
  assert.equal(state.lastError, error);
});

test("resolveActiveTarget prefers manual selection over detected or stabilized targets", () => {
  const target = resolveActiveTarget(
    { tuningId: "builtin:standard-e", mode: "manual", targetId: "string-1" },
    createReading(82.41),
    createStableReading(82.41, "string-6"),
    TARGETS,
  );

  assert.ok(target);
  assert.equal(target!.id, "string-1");
});

test("resolveActiveTarget falls back to stabilized target, then detected pitch", () => {
  const stabilized = resolveActiveTarget(
    DEFAULT_TUNER_SELECTION,
    null,
    createStableReading(110, "string-5"),
    TARGETS,
  );
  const detectedOnly = resolveActiveTarget(DEFAULT_TUNER_SELECTION, createReading(82.41), null, TARGETS);

  assert.ok(stabilized);
  assert.equal(stabilized!.id, "string-5");
  assert.ok(detectedOnly);
  assert.equal(detectedOnly!.id, "string-6");
});

test("resolveActiveTarget returns null in chromatic mode (no string attribution)", () => {
  const target = resolveActiveTarget(
    { tuningId: "builtin:standard-e", mode: "chromatic", targetId: null },
    createReading(82.41),
    createStableReading(82.41, "string-6"),
    TARGETS,
  );

  assert.equal(target, null);
});

test("resolveDeviation uses stabilized reading when available", () => {
  const target = findTarget("string-5");
  const deviation = resolveDeviation(target, createStableReading(111, "string-5"), createReading(109));

  assert.ok(deviation);
  assert.equal(deviation!.direction, "sharp");
  assert.ok(deviation!.cents > 0);
});

test("resolveDeviation returns null when target or reading is missing", () => {
  assert.equal(resolveDeviation(null, null, createReading(110)), null);
  assert.equal(resolveDeviation(findTarget("string-5"), null, null), null);
});
