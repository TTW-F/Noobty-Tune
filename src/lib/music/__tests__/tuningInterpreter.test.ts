import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TuningInterpreter } from "../tuningInterpreter";
import type { PitchTrackingState } from "../../../types/pitchTracking";
import type { TunerSelection } from "../../../types/tuner";

const interpreter = new TuningInterpreter();
const autoSelection: TunerSelection = { mode: "auto", targetId: null };
const manualSelection: TunerSelection = { mode: "manual", targetId: "string-6" };

describe("TuningInterpreter", () => {
  it("does not assign an auto target during acquiring", () => {
    const interpretation = interpreter.interpret(createTrackingState("acquiring", 82.41), autoSelection);

    assert.equal(interpretation.detectedNote, "E2");
    assert.equal(interpretation.targetId, null);
    assert.equal(interpretation.centsOffset, null);
  });

  it("does not assign an auto target during tracking", () => {
    const interpretation = interpreter.interpret(createTrackingState("tracking", 82.41), autoSelection);

    assert.equal(interpretation.targetId, null);
    assert.equal(interpretation.direction, "unknown");
  });

  it("assigns the closest target once tracking is locked", () => {
    const interpretation = interpreter.interpret(createTrackingState("locked", 83), autoSelection);

    assert.equal(interpretation.targetId, "string-6");
    assert.ok((interpretation.centsOffset ?? 0) > 0);
    assert.equal(interpretation.direction, "sharp");
  });

  it("keeps the interpreted target during degraded hold", () => {
    const interpretation = interpreter.interpret(createTrackingState("degraded", 82.41, 0.45), autoSelection);

    assert.equal(interpretation.targetId, "string-6");
    assert.equal(interpretation.detectedNote, "E2");
  });

  it("always honors the manual target when a frequency is present", () => {
    const interpretation = interpreter.interpret(createTrackingState("acquiring", 110), manualSelection);

    assert.equal(interpretation.detectedNote, "A2");
    assert.equal(interpretation.targetId, "string-6");
    assert.ok((interpretation.centsOffset ?? 0) > 400);
  });

  it("returns an empty interpretation after loss", () => {
    const interpretation = interpreter.interpret(createTrackingState("lost", null), autoSelection);

    assert.equal(interpretation.detectedFrequencyHz, null);
    assert.equal(interpretation.targetId, null);
  });
});

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
    stableDurationMs: stage === "locked" ? 1000 : 0,
    holdRemainingMs: 600,
    mismatchCount: 0,
    timestampMs: 1000,
  };
}
