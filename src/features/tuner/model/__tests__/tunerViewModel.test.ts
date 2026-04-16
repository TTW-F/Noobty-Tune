import test from "node:test";
import assert from "node:assert/strict";
import { TunerViewModelBuilder, createEmptyViewModel } from "../tunerViewModel";
import type { TuningInterpretation } from "../../../../types/pitchTracking";

function createInterpretation(
  trackingStage: TuningInterpretation["trackingStage"],
  overrides: Partial<TuningInterpretation> = {},
): TuningInterpretation {
  return {
    detectedFrequencyHz: null,
    detectedNote: null,
    targetId: null,
    targetFrequencyHz: null,
    centsOffset: null,
    direction: "unknown",
    confidence: 0,
    trackingStage,
    ...overrides,
  };
}

test("view model keeps target hidden while acquiring", () => {
  const builder = new TunerViewModelBuilder();

  const viewModel = builder.build(
    createInterpretation("acquiring", {
      detectedFrequencyHz: 82.41,
      detectedNote: "E2",
      targetId: "string-6",
      confidence: 0.84,
    }),
  );

  assert.equal(viewModel.uiStage, "acquiring");
  assert.equal(viewModel.displayFrequency, "82.4 Hz");
  assert.equal(viewModel.displayTarget, null);
  assert.equal(viewModel.displayCents, "检测中");
  assert.equal(viewModel.needlePosition, 0);
  assert.equal(viewModel.showSuccess, false);
});

test("view model shows locked target and cents offset", () => {
  const builder = new TunerViewModelBuilder();

  const viewModel = builder.build(
    createInterpretation("locked", {
      detectedFrequencyHz: 82.41,
      detectedNote: "E2",
      targetId: "string-6",
      targetFrequencyHz: 82.41,
      centsOffset: 12.4,
      direction: "sharp",
      confidence: 0.88,
    }),
  );

  assert.equal(viewModel.displayFrequency, "E2");
  assert.equal(viewModel.displayTarget, "6弦 (E2)");
  assert.equal(viewModel.displayCents, "+12¢");
  assert.equal(viewModel.needlePosition, 0.248);
  assert.equal(viewModel.statusMessage, "音高偏高");
});

test("view model only shows success when locked and in tune", () => {
  const builder = new TunerViewModelBuilder();

  const successVm = builder.build(
    createInterpretation("locked", {
      detectedFrequencyHz: 82.41,
      detectedNote: "E2",
      targetId: "string-6",
      targetFrequencyHz: 82.41,
      centsOffset: 2,
      direction: "in-tune",
      confidence: 0.85,
    }),
  );
  const degradedVm = builder.build(
    createInterpretation("degraded", {
      detectedFrequencyHz: 82.41,
      detectedNote: "E2",
      targetId: "string-6",
      targetFrequencyHz: 82.41,
      centsOffset: 2,
      direction: "in-tune",
      confidence: 0.85,
    }),
  );

  assert.equal(successVm.showSuccess, true);
  assert.equal(degradedVm.showSuccess, false);
  assert.equal(degradedVm.displayCents, "信号变弱");
  assert.match(degradedVm.statusMessage, /信号变弱/);
});

test("empty view model remains safe for initial render", () => {
  const viewModel = createEmptyViewModel();

  assert.equal(viewModel.uiStage, "idle");
  assert.equal(viewModel.displayFrequency, "---");
  assert.equal(viewModel.displayCents, "---");
  assert.equal(viewModel.displayTarget, null);
  assert.equal(viewModel.showSuccess, false);
});
