import test from "node:test";
import assert from "node:assert/strict";
import { TuningInterpreter } from "../tuningInterpreter";
import type { PitchTrackingState } from "../../../types/pitchTracking";
import type { TunerSelection } from "../../../types/tuner";

function createTrackingState(
  stage: PitchTrackingState["stage"],
  frequencyHz: number | null,
  confidence = 0.85,
): PitchTrackingState {
  return {
    trackedFrequencyHz: frequencyHz,
    confidence,
    stage,
    lastStableFrequencyHz: frequencyHz,
    stableDurationMs: stage === "locked" ? 500 : 0,
    holdRemainingMs: 600,
    mismatchCount: 0,
    timestampMs: 0,
  };
}

test("interpreter keeps auto mode target null while acquiring", () => {
  const interpreter = new TuningInterpreter();
  const selection: TunerSelection = { mode: "auto", targetId: null };

  const interpretation = interpreter.interpret(
    createTrackingState("acquiring", 82.41, 0.84),
    selection,
  );

  assert.equal(interpretation.detectedNote, "E2");
  assert.equal(interpretation.targetId, null);
  assert.equal(interpretation.centsOffset, null);
  assert.equal(interpretation.direction, "unknown");
});

test("interpreter infers target once tracking is stable in auto mode", () => {
  const interpreter = new TuningInterpreter();
  const selection: TunerSelection = { mode: "auto", targetId: null };

  const interpretation = interpreter.interpret(
    createTrackingState("locked", 82.41, 0.9),
    selection,
  );

  assert.equal(interpretation.detectedNote, "E2");
  assert.equal(interpretation.targetId, "string-6");
  assert.equal(interpretation.targetFrequencyHz, 82.41);
  assert.ok(Math.abs(interpretation.centsOffset ?? 999) < 1);
  assert.equal(interpretation.direction, "in-tune");
});

test("interpreter keeps detected note and manual target separated", () => {
  const interpreter = new TuningInterpreter();
  const selection: TunerSelection = { mode: "manual", targetId: "string-6" };

  const interpretation = interpreter.interpret(
    createTrackingState("tracking", 110, 0.87),
    selection,
  );

  assert.equal(interpretation.detectedNote, "A2");
  assert.equal(interpretation.targetId, "string-6");
  assert.equal(interpretation.targetFrequencyHz, 82.41);
  assert.equal(interpretation.direction, "sharp");
  assert.ok((interpretation.centsOffset ?? 0) > 400);
});

test("interpreter clears tuning output after loss", () => {
  const interpreter = new TuningInterpreter();
  const selection: TunerSelection = { mode: "auto", targetId: null };

  const interpretation = interpreter.interpret(
    createTrackingState("lost", null, 0.2),
    selection,
  );

  assert.equal(interpretation.detectedFrequencyHz, null);
  assert.equal(interpretation.detectedNote, null);
  assert.equal(interpretation.targetId, null);
  assert.equal(interpretation.centsOffset, null);
  assert.equal(interpretation.trackingStage, "lost");
});
