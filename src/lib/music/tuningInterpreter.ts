import type { PitchTrackingState, TuningInterpretation } from "../../types/pitchTracking";
import type { TunerSelection, TuningStringId, TuningTarget } from "../../types/tuner";
import { findClosestTuningTarget, getCentsOffset, getClosestNoteMatch } from "./noteMapping";
import { getStandardTuningTarget } from "./standardTuning";

export class TuningInterpreter {
  interpret(
    trackingState: PitchTrackingState,
    selection: TunerSelection,
  ): TuningInterpretation {
    if (
      trackingState.stage === "idle" ||
      trackingState.stage === "lost" ||
      trackingState.trackedFrequencyHz === null
    ) {
      return this.createEmptyInterpretation(trackingState);
    }

    if (selection.mode === "manual" && selection.targetId) {
      return this.interpretManualMode(trackingState, selection.targetId);
    }

    return this.interpretAutoMode(trackingState);
  }

  private interpretAutoMode(trackingState: PitchTrackingState): TuningInterpretation {
    const { trackedFrequencyHz, stage, confidence } = trackingState;

    if (trackedFrequencyHz === null) {
      return this.createEmptyInterpretation(trackingState);
    }

    if (stage === "acquiring" || stage === "tracking") {
      return {
        detectedFrequencyHz: trackedFrequencyHz,
        detectedNote: this.getNoteName(trackedFrequencyHz),
        targetId: null,
        targetFrequencyHz: null,
        centsOffset: null,
        direction: "unknown",
        confidence,
        trackingStage: stage,
      };
    }

    const target = findClosestTuningTarget(trackedFrequencyHz);
    if (!target) {
      return {
        detectedFrequencyHz: trackedFrequencyHz,
        detectedNote: this.getNoteName(trackedFrequencyHz),
        targetId: null,
        targetFrequencyHz: null,
        centsOffset: null,
        direction: "unknown",
        confidence,
        trackingStage: stage,
      };
    }

    return this.createInterpretationWithTarget(trackingState, target);
  }

  private interpretManualMode(
    trackingState: PitchTrackingState,
    targetId: TuningStringId,
  ): TuningInterpretation {
    if (trackingState.trackedFrequencyHz === null) {
      return this.createEmptyInterpretation(trackingState);
    }

    const target = this.getManualTarget(targetId);
    if (!target) {
      return this.createEmptyInterpretation(trackingState);
    }

    return this.createInterpretationWithTarget(trackingState, target);
  }

  private createEmptyInterpretation(trackingState: PitchTrackingState): TuningInterpretation {
    return {
      detectedFrequencyHz: null,
      detectedNote: null,
      targetId: null,
      targetFrequencyHz: null,
      centsOffset: null,
      direction: "unknown",
      confidence: trackingState.confidence,
      trackingStage: trackingState.stage,
    };
  }

  private createInterpretationWithTarget(
    trackingState: PitchTrackingState,
    target: TuningTarget,
  ): TuningInterpretation {
    const { trackedFrequencyHz, confidence, stage } = trackingState;

    if (trackedFrequencyHz === null) {
      return this.createEmptyInterpretation(trackingState);
    }

    const cents = getCentsOffset(trackedFrequencyHz, target.frequencyHz);
    return {
      detectedFrequencyHz: trackedFrequencyHz,
      detectedNote: this.getNoteName(trackedFrequencyHz),
      targetId: target.id,
      targetFrequencyHz: target.frequencyHz,
      centsOffset: cents,
      direction: this.getDirection(cents),
      confidence,
      trackingStage: stage,
    };
  }

  private getManualTarget(targetId: TuningStringId): TuningTarget | null {
    try {
      return getStandardTuningTarget(targetId);
    } catch {
      return null;
    }
  }

  private getDirection(cents: number): "flat" | "sharp" | "in-tune" | "unknown" {
    const inTuneThreshold = 5;
    if (Math.abs(cents) <= inTuneThreshold) {
      return "in-tune";
    }

    return cents < 0 ? "flat" : "sharp";
  }

  private getNoteName(frequencyHz: number): string {
    const match = getClosestNoteMatch(frequencyHz);
    if (!match) {
      return `${frequencyHz.toFixed(1)} Hz`;
    }

    return `${match.note}${match.octave}`;
  }
}
