import type {
  TuningInterpretation,
  TunerUiStage,
  TunerViewModel,
} from "../../../types/pitchTracking";

const STRING_LABELS: Record<string, string> = {
  "string-6": "String 6 (E2)",
  "string-5": "String 5 (A2)",
  "string-4": "String 4 (D3)",
  "string-3": "String 3 (G3)",
  "string-2": "String 2 (B3)",
  "string-1": "String 1 (E4)",
};

export class TunerViewModelBuilder {
  build(interpretation: TuningInterpretation): TunerViewModel {
    const uiStage = this.mapTrackingStageToUiStage(interpretation.trackingStage);

    return {
      uiStage,
      displayFrequency: this.formatDisplayFrequency(interpretation),
      displayCents: this.formatDisplayCents(interpretation),
      displayTarget: this.formatDisplayTarget(interpretation),
      needlePosition: this.calculateNeedlePosition(interpretation),
      showSuccess: this.shouldShowSuccess(interpretation),
      statusMessage: this.getStatusMessage(interpretation),
      confidence: interpretation.confidence,
    };
  }

  private mapTrackingStageToUiStage(stage: TuningInterpretation["trackingStage"]): TunerUiStage {
    return stage;
  }

  private formatDisplayFrequency(interpretation: TuningInterpretation): string {
    const { detectedFrequencyHz, detectedNote, trackingStage } = interpretation;

    if (detectedFrequencyHz === null) {
      return "---";
    }

    if (trackingStage === "acquiring") {
      return `${detectedFrequencyHz.toFixed(1)} Hz`;
    }

    return detectedNote ?? `${detectedFrequencyHz.toFixed(1)} Hz`;
  }

  private formatDisplayCents(interpretation: TuningInterpretation): string {
    const { centsOffset, trackingStage } = interpretation;

    if (trackingStage === "acquiring") {
      return "Listening...";
    }

    if (trackingStage === "tracking") {
      return "Settling...";
    }

    if (trackingStage === "degraded") {
      return "Signal fading";
    }

    if (centsOffset === null) {
      return "---";
    }

    const rounded = Math.round(centsOffset);
    if (rounded === 0) {
      return "0 cent";
    }

    return rounded > 0 ? `+${rounded} cent` : `${rounded} cent`;
  }

  private formatDisplayTarget(interpretation: TuningInterpretation): string | null {
    const { targetId, trackingStage } = interpretation;

    if (!targetId || trackingStage === "acquiring" || trackingStage === "tracking") {
      return null;
    }

    return STRING_LABELS[targetId] ?? targetId;
  }

  private calculateNeedlePosition(interpretation: TuningInterpretation): number {
    const { centsOffset, trackingStage } = interpretation;

    if (
      centsOffset === null ||
      trackingStage === "acquiring" ||
      trackingStage === "tracking" ||
      trackingStage === "lost"
    ) {
      return 0;
    }

    return Math.max(-1, Math.min(1, centsOffset / 50));
  }

  private shouldShowSuccess(interpretation: TuningInterpretation): boolean {
    return (
      interpretation.trackingStage === "locked" &&
      interpretation.direction === "in-tune" &&
      interpretation.confidence >= 0.85
    );
  }

  private getStatusMessage(interpretation: TuningInterpretation): string {
    const { trackingStage, direction } = interpretation;

    switch (trackingStage) {
      case "idle":
        return "Pluck one string to begin.";
      case "acquiring":
        return "Listening for a stable note.";
      case "tracking":
        return "Following the note. Waiting before choosing a target.";
      case "locked":
        if (direction === "in-tune") {
          return "Pitch is locked and in tune.";
        }
        return direction === "flat" ? "Pitch is below the target." : "Pitch is above the target.";
      case "degraded":
        return "Still tracking, but the signal is getting weaker.";
      case "lost":
        return "Tracking was lost. Pluck again to continue.";
      default:
        return "";
    }
  }
}

export function createEmptyViewModel(): TunerViewModel {
  return {
    uiStage: "idle",
    displayFrequency: "---",
    displayCents: "---",
    displayTarget: null,
    needlePosition: 0,
    showSuccess: false,
    statusMessage: "Pluck one string to begin.",
    confidence: 0,
  };
}
