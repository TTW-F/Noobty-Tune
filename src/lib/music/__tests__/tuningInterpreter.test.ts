import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STANDARD_TUNING_TARGETS } from "../tuning";
import { TuningInterpreter } from "../tuningInterpreter";
import type { PitchTrackingState } from "../../../types/pitchTracking";
import type { TunerSelection, TuningTarget } from "../../../types/tuner";

const STANDARD_TARGETS = STANDARD_TUNING_TARGETS;
const interpreter = new TuningInterpreter(STANDARD_TARGETS);
const autoSelection: TunerSelection = { tuningId: "builtin:standard-e", mode: "auto", targetId: null };
const manualSelection: TunerSelection = { tuningId: "builtin:standard-e", mode: "manual", targetId: "string-6" };
const chromaticSelection: TunerSelection = {
  tuningId: "builtin:standard-e",
  mode: "chromatic",
  targetId: null,
};

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

  it("ignores a manual target that the active tuning does not contain", () => {
    const sevenStringOnly: TunerSelection = {
      tuningId: "builtin:standard-e",
      mode: "manual",
      targetId: "string-7",
    };
    const interpretation = interpreter.interpret(createTrackingState("locked", 110), sevenStringOnly);

    assert.equal(interpretation.targetId, null);
    assert.equal(interpretation.centsOffset, null);
  });

  it("returns an empty interpretation after loss", () => {
    const interpretation = interpreter.interpret(createTrackingState("lost", null), autoSelection);

    assert.equal(interpretation.detectedFrequencyHz, null);
    assert.equal(interpretation.targetId, null);
  });

  it("sticks with the previous target near the midpoint between two strings", () => {
    const sticky = new TuningInterpreter(STANDARD_TARGETS);
    const locked = sticky.interpret(createTrackingState("locked", 82.41), autoSelection);
    assert.equal(locked.targetId, "string-6");

    // 95.3 Hz is ~250 cents from both E2 and A2; A2 is marginally closer but
    // well inside the switch margin, so the previous target must be kept.
    const interpretation = sticky.interpret(createTrackingState("locked", 95.3), autoSelection);

    assert.equal(interpretation.targetId, "string-6");
  });

  it("switches to a new target when it is decisively closer", () => {
    const sticky = new TuningInterpreter(STANDARD_TARGETS);
    sticky.interpret(createTrackingState("locked", 82.41), autoSelection);

    const interpretation = sticky.interpret(createTrackingState("locked", 98), autoSelection);

    assert.equal(interpretation.targetId, "string-5");
  });

  it("returns to the closest target after reset", () => {
    const sticky = new TuningInterpreter(STANDARD_TARGETS);
    sticky.interpret(createTrackingState("locked", 82.41), autoSelection);
    sticky.reset();

    // Without prior state the closest string wins again (A2 for 95.3 Hz).
    const interpretation = sticky.interpret(createTrackingState("locked", 95.3), autoSelection);

    assert.equal(interpretation.targetId, "string-5");
  });

  it("chromatic mode judges against the nearest chromatic note without assigning a string", () => {
    // 100 Hz 距 G2(98 Hz)约 +35 音分
    const interpretation = interpreter.interpret(createTrackingState("locked", 100), chromaticSelection);

    assert.equal(interpretation.targetId, null);
    assert.equal(interpretation.detectedNote, "G2");
    assert.ok(interpretation.targetFrequencyHz !== null);
    assert.ok((interpretation.centsOffset ?? 0) > 30);
    assert.equal(interpretation.direction, "sharp");
  });

  it("chromatic mode reports cents as soon as a frequency exists", () => {
    const interpretation = interpreter.interpret(createTrackingState("acquiring", 100), chromaticSelection);

    assert.equal(interpretation.targetId, null);
    assert.ok(interpretation.centsOffset !== null);
    assert.equal(interpretation.trackingStage, "acquiring");
  });

  it("chromatic mode never writes the sticky target", () => {
    const sticky = new TuningInterpreter(STANDARD_TARGETS);
    sticky.interpret(createTrackingState("locked", 82.41), chromaticSelection);

    // 切回 auto 后没有从 chromatic 继承的归属:95.3 Hz 直接归最近的 A2
    const interpretation = sticky.interpret(createTrackingState("locked", 95.3), autoSelection);

    assert.equal(interpretation.targetId, "string-5");
  });

  it("holds hysteresis on a narrow-interval synthetic tuning (open-tuning like)", () => {
    // 相邻目标只差一个八度(D2/D3),中点附近自动归属的判定区间远比标准调弦窄。
    const narrowTargets: TuningTarget[] = [
      { id: "string-6", label: "6", note: "D", octave: 2, frequencyHz: 73.42 },
      { id: "string-5", label: "5", note: "D", octave: 3, frequencyHz: 146.83 },
    ];
    const narrow = new TuningInterpreter(narrowTargets);

    const locked = narrow.interpret(createTrackingState("locked", 73.42), autoSelection);
    assert.equal(locked.targetId, "string-6");

    // 103.98 Hz 距 D3 只近约 5 音分,远在 15 音分切换余量内 → 保持原目标。
    const stuck = narrow.interpret(createTrackingState("locked", 103.98), autoSelection);
    assert.equal(stuck.targetId, "string-6");

    // 110 Hz 距 D3 近约 100 音分, decisively closer → 切换。
    const switched = narrow.interpret(createTrackingState("locked", 110), autoSelection);
    assert.equal(switched.targetId, "string-5");
  });

  it("keeps the sticky target across a chromatic detour and still yields decisively", () => {
    const sticky = new TuningInterpreter(STANDARD_TARGETS);
    sticky.interpret(createTrackingState("locked", 82.41), autoSelection);
    // 自由模式绕行:不读写 sticky
    sticky.interpret(createTrackingState("locked", 100), chromaticSelection);

    // 切回 auto:残留的 sticky 在切换余量内继续压表(95.3 Hz 距 A2 仅近 ~2 音分)
    const resumed = sticky.interpret(createTrackingState("locked", 95.3), autoSelection);
    assert.equal(resumed.targetId, "string-6");

    // 但对 decisively closer 的弦照常让位
    const decisive = sticky.interpret(createTrackingState("locked", 110), autoSelection);
    assert.equal(decisive.targetId, "string-5");
  });

  it("clears the sticky target when the target set is replaced", () => {
    const sticky = new TuningInterpreter(STANDARD_TARGETS);
    sticky.interpret(createTrackingState("locked", 82.41), autoSelection);

    // 同一份目标的浅拷贝代表"换调弦"——迟滞必须被清空,
    // 否则旧调弦的 sticky target 会被带进新调弦。
    sticky.setTargets([...STANDARD_TARGETS]);

    const interpretation = sticky.interpret(createTrackingState("locked", 95.3), autoSelection);
    assert.equal(interpretation.targetId, "string-5");
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
