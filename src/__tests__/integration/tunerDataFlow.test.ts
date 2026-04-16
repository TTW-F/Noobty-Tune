import test from "node:test";
import assert from "node:assert/strict";
import { ContinuousPitchTracker } from "../../lib/audio/continuousPitchTracker";
import { TuningInterpreter } from "../../lib/music/tuningInterpreter";
import { TunerViewModelBuilder } from "../../features/tuner/model/tunerViewModel";
import type { RawPitchCandidate } from "../../types/pitchTracking";
import type { TunerSelection } from "../../types/tuner";

function createCandidate(
  frequencyHz: number | null,
  clarity: number,
  timestampMs: number,
): RawPitchCandidate {
  return {
    frequencyHz,
    clarity,
    rms: frequencyHz === null ? 0.001 : 0.01,
    peak: frequencyHz === null ? 0.002 : 0.05,
    timestampMs,
    algorithm: "yin",
  };
}

test("pipeline hides target during acquiring and exposes it after lock", () => {
  const tracker = new ContinuousPitchTracker();
  const interpreter = new TuningInterpreter();
  const viewModelBuilder = new TunerViewModelBuilder();
  const selection: TunerSelection = { mode: "auto", targetId: null };

  const acquiring = tracker.update(createCandidate(82.41, 0.85, 0));
  const acquiringInterpretation = interpreter.interpret(acquiring, selection);
  const acquiringViewModel = viewModelBuilder.build(acquiringInterpretation);

  tracker.update(createCandidate(82.4, 0.86, 75));
  const locked = tracker.update(createCandidate(82.42, 0.87, 150));
  const lockedInterpretation = interpreter.interpret(locked, selection);
  const lockedViewModel = viewModelBuilder.build(lockedInterpretation);

  assert.equal(acquiring.stage, "acquiring");
  assert.equal(acquiringInterpretation.targetId, null);
  assert.equal(acquiringViewModel.displayTarget, null);
  assert.equal(acquiringViewModel.displayCents, "检测中");

  assert.equal(locked.stage, "locked");
  assert.equal(lockedInterpretation.targetId, "string-6");
  assert.equal(lockedViewModel.displayTarget, "6弦 (E2)");
});

test("pipeline preserves target context while degraded and then clears it after loss", () => {
  const tracker = new ContinuousPitchTracker({ releaseAfterMisses: 8 });
  const interpreter = new TuningInterpreter();
  const viewModelBuilder = new TunerViewModelBuilder();
  const selection: TunerSelection = { mode: "auto", targetId: null };

  tracker.update(createCandidate(82.41, 0.85, 0));
  tracker.update(createCandidate(82.4, 0.86, 75));
  tracker.update(createCandidate(82.42, 0.87, 150));

  let degraded = tracker.getState();
  for (let index = 0; index < 4; index += 1) {
    degraded = tracker.update(createCandidate(null, 0, 225 + index * 75));
  }

  const degradedInterpretation = interpreter.interpret(degraded, selection);
  const degradedViewModel = viewModelBuilder.build(degradedInterpretation);

  let lost = degraded;
  for (let index = 0; index < 4; index += 1) {
    lost = tracker.update(createCandidate(null, 0, 525 + index * 75));
  }

  const lostInterpretation = interpreter.interpret(lost, selection);
  const lostViewModel = viewModelBuilder.build(lostInterpretation);

  assert.equal(degraded.stage, "degraded");
  assert.equal(degradedInterpretation.targetId, "string-6");
  assert.equal(degradedViewModel.displayTarget, "6弦 (E2)");
  assert.equal(degradedViewModel.displayCents, "信号变弱");
  assert.equal(degradedViewModel.showSuccess, false);

  assert.equal(lost.stage, "lost");
  assert.equal(lostInterpretation.targetId, null);
  assert.equal(lostViewModel.displayTarget, null);
  assert.equal(lostViewModel.showSuccess, false);
});

test("manual mode keeps target fixed even when detected note differs", () => {
  const tracker = new ContinuousPitchTracker();
  const interpreter = new TuningInterpreter();
  const viewModelBuilder = new TunerViewModelBuilder();
  const selection: TunerSelection = { mode: "manual", targetId: "string-6" };

  tracker.update(createCandidate(110, 0.85, 0));
  tracker.update(createCandidate(110, 0.86, 75));
  const tracked = tracker.update(createCandidate(110, 0.87, 150));

  const interpretation = interpreter.interpret(tracked, selection);
  const viewModel = viewModelBuilder.build(interpretation);

  assert.equal(tracked.stage, "locked");
  assert.equal(interpretation.detectedNote, "A2");
  assert.equal(interpretation.targetId, "string-6");
  assert.equal(viewModel.displayTarget, "6弦 (E2)");
  assert.equal(viewModel.showSuccess, false);
});
