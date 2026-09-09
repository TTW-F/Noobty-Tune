import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TunerViewModelBuilder } from "../tunerViewModel";
import type { TuningInterpretation } from "../../../../types/pitchTracking";

const builder = new TunerViewModelBuilder();

describe("TunerViewModelBuilder", () => {
  it("keeps acquiring honest by hiding target and cents", () => {
    const viewModel = builder.build(createInterpretation("acquiring", 82.41));

    assert.equal(viewModel.uiStage, "acquiring");
    assert.equal(viewModel.displayTarget, null);
    assert.equal(viewModel.displayCents, "Listening...");
  });

  it("keeps tracking honest by still hiding the auto target", () => {
    const viewModel = builder.build(createInterpretation("tracking", 82.41));

    assert.equal(viewModel.displayTarget, null);
    assert.equal(viewModel.statusMessage, "Following the note. Waiting before choosing a target.");
  });

  it("shows target and cents after lock", () => {
    const viewModel = builder.build(
      createInterpretation("locked", 82.41, {
        targetId: "string-6",
        centsOffset: -6,
        direction: "flat",
      }),
    );

    assert.equal(viewModel.displayTarget, "String 6 (E2)");
    assert.equal(viewModel.displayCents, "-6 cent");
  });

  it("shows degraded as weakening instead of success", () => {
    const viewModel = builder.build(
      createInterpretation("degraded", 82.41, {
        targetId: "string-6",
        centsOffset: 2,
        direction: "in-tune",
      }),
    );

    assert.equal(viewModel.displayCents, "Signal fading");
    assert.equal(viewModel.showSuccess, false);
  });

  it("only shows success for locked + in-tune + high confidence", () => {
    const success = builder.build(
      createInterpretation("locked", 82.41, {
        targetId: "string-6",
        centsOffset: 1,
        direction: "in-tune",
        confidence: 0.9,
      }),
    );
    const tooEarly = builder.build(
      createInterpretation("tracking", 82.41, {
        targetId: null,
        centsOffset: null,
        direction: "unknown",
      }),
    );

    assert.equal(success.showSuccess, true);
    assert.equal(tooEarly.showSuccess, false);
  });

  it("latches success so boundary readings cannot flap the banner", () => {
    const latching = new TunerViewModelBuilder();

    const enter = latching.build(
      createInterpretation("locked", 82.41, {
        targetId: "string-6",
        centsOffset: 4,
        direction: "in-tune",
        confidence: 0.9,
      }),
    );
    assert.equal(enter.showSuccess, true);

    // Drifts to +7 cents: outside the entry gate, inside the release gate.
    const hold = latching.build(
      createInterpretation("locked", 82.46, {
        targetId: "string-6",
        centsOffset: 7,
        direction: "sharp",
        confidence: 0.9,
      }),
    );
    assert.equal(hold.showSuccess, true);

    const exit = latching.build(
      createInterpretation("locked", 82.75, {
        targetId: "string-6",
        centsOffset: 35,
        direction: "sharp",
        confidence: 0.9,
      }),
    );
    assert.equal(exit.showSuccess, false);

    const reenter = latching.build(
      createInterpretation("locked", 82.41, {
        targetId: "string-6",
        centsOffset: 0,
        direction: "in-tune",
        confidence: 0.9,
      }),
    );
    assert.equal(reenter.showSuccess, true);
  });
});

function createInterpretation(
  trackingStage: TuningInterpretation["trackingStage"],
  detectedFrequencyHz: number | null,
  overrides: Partial<TuningInterpretation> = {},
): TuningInterpretation {
  return {
    detectedFrequencyHz,
    detectedNote: detectedFrequencyHz ? "E2" : null,
    targetId: null,
    targetFrequencyHz: null,
    centsOffset: null,
    direction: "unknown",
    confidence: 0.85,
    trackingStage,
    ...overrides,
  };
}
