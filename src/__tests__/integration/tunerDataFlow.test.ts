import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ContinuousPitchTracker } from "../../lib/audio/continuousPitchTracker";
import { TuningInterpreter } from "../../lib/music/tuningInterpreter";
import { TunerViewModelBuilder } from "../../features/tuner/model/tunerViewModel";
import type { RawPitchCandidate } from "../../types/pitchTracking";
import type { TunerSelection } from "../../types";

describe("tuner data flow", () => {
  it("moves from acquiring to locked to degraded to lost without flashing success early", () => {
    const tracker = new ContinuousPitchTracker({
      holdDurationMs: 225,
      releaseAfterMisses: 6,
    });
    const interpreter = new TuningInterpreter();
    const viewModelBuilder = new TunerViewModelBuilder();
    const selection: TunerSelection = { mode: "auto", targetId: null };
    let timestampMs = 0;

    const acquire = buildFrame(tracker, interpreter, viewModelBuilder, selection, createCandidate(82.41, 0.86, next()));
    const warmup = buildFrame(tracker, interpreter, viewModelBuilder, selection, createCandidate(82.40, 0.74, next()));
    const track = buildFrame(tracker, interpreter, viewModelBuilder, selection, createCandidate(82.42, 0.76, next()));
    const preLock = buildFrame(tracker, interpreter, viewModelBuilder, selection, createCandidate(82.41, 0.9, next()));
    const lock = buildFrame(tracker, interpreter, viewModelBuilder, selection, createCandidate(82.41, 0.91, next()));
    const hold = buildFrame(tracker, interpreter, viewModelBuilder, selection, createNullCandidate(next()));
    buildFrame(tracker, interpreter, viewModelBuilder, selection, createNullCandidate(next()));
    const degrade = buildFrame(tracker, interpreter, viewModelBuilder, selection, createNullCandidate(next()));
    buildFrame(tracker, interpreter, viewModelBuilder, selection, createNullCandidate(next()));
    buildFrame(tracker, interpreter, viewModelBuilder, selection, createNullCandidate(next()));
    const lost = buildFrame(tracker, interpreter, viewModelBuilder, selection, createNullCandidate(next()));

    assert.equal(acquire.tracked.stage, "acquiring");
    assert.equal(warmup.tracked.stage, "acquiring");
    assert.equal(acquire.interpretation.targetId, null);
    assert.equal(track.tracked.stage, "tracking");
    assert.equal(track.viewModel.showSuccess, false);
    assert.equal(preLock.tracked.stage, "tracking");
    assert.equal(lock.tracked.stage, "locked");
    assert.equal(lock.interpretation.targetId, "string-6");
    assert.equal(hold.tracked.stage, "locked");
    assert.equal(degrade.tracked.stage, "degraded");
    assert.equal(degrade.viewModel.displayCents, "Signal fading");
    assert.equal(lost.tracked.stage, "lost");

    function next() {
      timestampMs += 75;
      return timestampMs;
    }
  });

  it("keeps manual targeting available before auto targeting would lock", () => {
    const tracker = new ContinuousPitchTracker();
    const interpreter = new TuningInterpreter();
    const viewModelBuilder = new TunerViewModelBuilder();
    const manualSelection: TunerSelection = { mode: "manual", targetId: "string-6" };

    const frame = buildFrame(
      tracker,
      interpreter,
      viewModelBuilder,
      manualSelection,
      createCandidate(110, 0.85, 75),
    );

    assert.equal(frame.tracked.stage, "acquiring");
    assert.equal(frame.interpretation.detectedNote, "A2");
    assert.equal(frame.interpretation.targetId, "string-6");
    assert.equal(frame.viewModel.displayTarget, null);
  });
});

function buildFrame(
  tracker: ContinuousPitchTracker,
  interpreter: TuningInterpreter,
  viewModelBuilder: TunerViewModelBuilder,
  selection: TunerSelection,
  candidate: RawPitchCandidate,
) {
  const tracked = tracker.update(candidate);
  const interpretation = interpreter.interpret(tracked, selection);
  const viewModel = viewModelBuilder.build(interpretation);

  return {
    tracked,
    interpretation,
    viewModel,
  };
}

function createCandidate(
  frequencyHz: number,
  clarity: number,
  timestampMs: number,
): RawPitchCandidate {
  return {
    frequencyHz,
    clarity,
    rms: 0.01,
    peak: 0.05,
    timestampMs,
    algorithm: "yin",
  };
}

function createNullCandidate(timestampMs: number): RawPitchCandidate {
  return {
    frequencyHz: null,
    clarity: 0,
    rms: 0.001,
    peak: 0.002,
    timestampMs,
    algorithm: "yin",
  };
}
