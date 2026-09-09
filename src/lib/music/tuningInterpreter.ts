import type { PitchTrackingState, TuningInterpretation } from "../../types/pitchTracking";
import type { TunerSelection, TuningStringId, TuningTarget } from "../../types/tuner";
import { findClosestTuningTarget, getCentsOffset, getClosestNoteMatch } from "./noteMapping";
import { getStandardTuningTarget } from "./standardTuning";

/**
 * Auto mode keeps the previously assigned target until another string is
 * closer by at least this margin. Without it, a tracked pitch sitting near the
 * midpoint between two open strings flips targets from frame to frame and the
 * tuning needle jumps between them.
 */
const TARGET_SWITCH_MARGIN_CENTS = 15;

export class TuningInterpreter {
  private lastAutoTargetId: TuningStringId | null = null;

  reset(): void {
    this.lastAutoTargetId = null;
  }

  interpret(
    trackingState: PitchTrackingState,
    selection: TunerSelection,
  ): TuningInterpretation {
    if (
      trackingState.stage === "idle" ||
      trackingState.stage === "lost" ||
      trackingState.trackedFrequencyHz === null
    ) {
      this.lastAutoTargetId = null;
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

    const target = this.resolveAutoTarget(trackedFrequencyHz);
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

  /**
   * Hysteresis: stick with the previous target unless the new closest string
   * is decisively closer, so the needle cannot oscillate between neighbours
   * when the tracked pitch sits near the midpoint between two open strings.
   */
  private resolveAutoTarget(frequencyHz: number): TuningTarget | null {
    const closest = findClosestTuningTarget(frequencyHz);
    if (!closest) {
      return null;
    }

    const lastTarget = this.getLastAutoTarget();
    if (!lastTarget || lastTarget.id === closest.id) {
      this.lastAutoTargetId = closest.id;
      return closest;
    }

    const centsToClosest = Math.abs(getCentsOffset(frequencyHz, closest.frequencyHz));
    const centsToLast = Math.abs(getCentsOffset(frequencyHz, lastTarget.frequencyHz));

    if (centsToClosest + TARGET_SWITCH_MARGIN_CENTS < centsToLast) {
      this.lastAutoTargetId = closest.id;
      return closest;
    }

    return lastTarget;
  }

  private getLastAutoTarget(): TuningTarget | null {
    if (!this.lastAutoTargetId) {
      return null;
    }

    try {
      return getStandardTuningTarget(this.lastAutoTargetId);
    } catch {
      this.lastAutoTargetId = null;
      return null;
    }
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
