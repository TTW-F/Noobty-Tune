import type { PitchTrackingState, TuningInterpretation } from "../../types/pitchTracking";
import type { TunerSelection, TuningStringId, TuningTarget } from "../../types/tuner";
import { findClosestTuningTarget, getCentsOffset, getClosestNoteMatch } from "./noteMapping";

/**
 * Auto mode keeps the previously assigned target until another string is
 * closer by at least this margin. Without it, a tracked pitch sitting near the
 * midpoint between two open strings flips targets from frame to frame and the
 * tuning needle jumps between them.
 */
const TARGET_SWITCH_MARGIN_CENTS = 15;

export class TuningInterpreter {
  private targets: readonly TuningTarget[];
  private lastAutoTargetId: TuningStringId | null = null;

  constructor(targets: readonly TuningTarget[]) {
    this.targets = targets;
  }

  /**
   * 换调弦时替换目标集。迟滞随目标集一起清空——新调弦没有"上一根弦"。
   */
  setTargets(targets: readonly TuningTarget[]): void {
    this.targets = targets;
    this.lastAutoTargetId = null;
  }

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

    if (selection.mode === "chromatic") {
      return this.interpretChromaticMode(trackingState);
    }

    if (selection.mode === "manual" && selection.targetId) {
      return this.interpretManualMode(trackingState, selection.targetId);
    }

    return this.interpretAutoMode(trackingState);
  }

  /**
   * 自由模式:不归属弦,以最近的半音名为参照给出音分偏差。
   * 只要频率存在就计算——chromatic 没有"目标指派"的诚实性问题,
   * 因此不做 auto 模式那套 acquiring/tracking 的克制输出。
   * 永不读写 sticky target:从 chromatic 切回 auto 时不残留归属。
   */
  private interpretChromaticMode(trackingState: PitchTrackingState): TuningInterpretation {
    const { trackedFrequencyHz, stage, confidence } = trackingState;

    if (trackedFrequencyHz === null) {
      return this.createEmptyInterpretation(trackingState);
    }

    const nearestNote = getClosestNoteMatch(trackedFrequencyHz);
    const cents =
      nearestNote !== null
        ? getCentsOffset(trackedFrequencyHz, nearestNote.frequencyHz)
        : null;

    return {
      detectedFrequencyHz: trackedFrequencyHz,
      detectedNote: this.getNoteName(trackedFrequencyHz),
      targetId: null,
      targetFrequencyHz: nearestNote?.frequencyHz ?? null,
      centsOffset: cents,
      direction: cents === null ? "unknown" : this.getDirection(cents),
      confidence,
      trackingStage: stage,
    };
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
    const closest = findClosestTuningTarget(frequencyHz, this.targets);
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

    return this.targets.find((target) => target.id === this.lastAutoTargetId) ?? null;
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
    return this.targets.find((target) => target.id === targetId) ?? null;
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
