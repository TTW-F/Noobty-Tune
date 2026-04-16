import type { TunerViewModel } from "../../../types/pitchTracking";
import type { TunerState } from "../../../types/tuner";

export interface EnhancedDisplayState {
  readonly displayNote: string;
  readonly displayTarget: string | null;
  readonly displayCents: string;
  readonly displayFrequency: string;
  readonly statusMessage: string;
  readonly statusTone: "idle" | "info" | "warning" | "success" | "error";
  readonly showSuccess: boolean;
  readonly showDegraded: boolean;
  readonly needlePosition: number;
  readonly needleActive: boolean;
  readonly coachTitle: string;
  readonly coachBody: string;
  readonly coachTone: "idle" | "active" | "warning" | "success";
  readonly stageLabel: string;
  readonly confidencePercent: number;
}

export function adaptViewModelToDisplay(
  viewModel: TunerViewModel,
  legacyState: TunerState,
): EnhancedDisplayState {
  const {
    uiStage,
    displayFrequency,
    displayCents,
    displayTarget,
    needlePosition,
    showSuccess,
    statusMessage,
    confidence,
  } = viewModel;

  const displayNote = getDisplayNote(uiStage, displayFrequency, legacyState);
  const enhancedTarget = uiStage === "acquiring" ? null : displayTarget;
  const enhancedCents = getEnhancedCents(uiStage, displayCents);
  const statusTone = getStatusTone(uiStage, showSuccess);
  const coach = getCoachContent(uiStage, displayTarget, displayCents);

  return {
    displayNote,
    displayTarget: enhancedTarget,
    displayCents: enhancedCents,
    displayFrequency,
    statusMessage,
    statusTone,
    showSuccess,
    showDegraded: uiStage === "degraded",
    needlePosition,
    needleActive: !["idle", "lost", "acquiring"].includes(uiStage),
    coachTitle: coach.title,
    coachBody: coach.body,
    coachTone: coach.tone,
    stageLabel: getStageLabel(uiStage),
    confidencePercent: Math.round(confidence * 100),
  };
}

function getDisplayNote(
  stage: TunerViewModel["uiStage"],
  displayFrequency: string,
  legacyState: TunerState,
): string {
  if (stage === "acquiring" || stage === "tracking") {
    return displayFrequency;
  }

  if (legacyState.activeTarget && stage === "locked" && displayFrequency === "---") {
    return `${legacyState.activeTarget.note}${legacyState.activeTarget.octave}`;
  }

  return displayFrequency;
}

function getEnhancedCents(
  stage: TunerViewModel["uiStage"],
  displayCents: string,
): string {
  if (stage === "acquiring") {
    return "Detecting...";
  }

  if (stage === "degraded") {
    return "Signal fading";
  }

  return displayCents;
}

function getStatusTone(
  stage: TunerViewModel["uiStage"],
  showSuccess: boolean,
): "idle" | "info" | "warning" | "success" | "error" {
  if (showSuccess) {
    return "success";
  }

  switch (stage) {
    case "acquiring":
    case "tracking":
    case "locked":
      return "info";
    case "degraded":
      return "warning";
    case "permission-denied":
    case "error":
      return "error";
    default:
      return "idle";
  }
}

function getCoachContent(
  stage: TunerViewModel["uiStage"],
  displayTarget: string | null,
  displayCents: string,
): { title: string; body: string; tone: "idle" | "active" | "warning" | "success" } {
  switch (stage) {
    case "idle":
      return {
        title: "Ready to Start",
        body: 'Tap "Start Tuning", then pluck one string clearly.',
        tone: "idle",
      };
    case "acquiring":
      return {
        title: "Detecting Pitch",
        body: "A note is coming in. Let it ring a little longer so the tuner can lock on.",
        tone: "active",
      };
    case "tracking":
      return {
        title: "Tracking Pitch",
        body: "The tuner is following the note, but it is still waiting before committing to a target string.",
        tone: "active",
      };
    case "locked":
      return {
        title: "Pitch Locked",
        body: displayTarget
          ? `Target: ${displayTarget}. Make small tuning changes and pluck again.`
          : "Pitch is locked. Make small tuning changes and pluck again.",
        tone: "active",
      };
    case "degraded":
      return {
        title: "Signal Fading",
        body: "The tuner is still following the note, but the sustain is weakening. Re-pluck if needed.",
        tone: "warning",
      };
    case "lost":
      return {
        title: "Signal Lost",
        body: "Tracking stopped. Pluck the string again to continue tuning.",
        tone: "idle",
      };
    case "permission-denied":
      return {
        title: "Microphone Blocked",
        body: "Allow microphone access in the browser settings, then refresh and try again.",
        tone: "warning",
      };
    case "error":
      return {
        title: "Audio Error",
        body: "Refresh the page and try again. If the issue persists, check browser audio support.",
        tone: "warning",
      };
    default:
      return {
        title: "Waiting for Input",
        body: "Pluck one string to begin tuning.",
        tone: "idle",
      };
  }
}

function getStageLabel(stage: TunerViewModel["uiStage"]): string {
  const labels: Record<TunerViewModel["uiStage"], string> = {
    idle: "Idle",
    acquiring: "Acquiring",
    tracking: "Tracking",
    locked: "Locked",
    degraded: "Degraded",
    lost: "Lost",
    "permission-denied": "Permission Denied",
    error: "Error",
  };

  return labels[stage] ?? stage;
}

export function shouldShowSuccessPanel(viewModel: TunerViewModel): boolean {
  return viewModel.uiStage === "locked" && viewModel.showSuccess && viewModel.confidence >= 0.8;
}

export function shouldShowDegradedWarning(viewModel: TunerViewModel): boolean {
  return viewModel.uiStage === "degraded";
}

export function getStatusBadgeClass(stage: TunerViewModel["uiStage"]): string {
  const baseClass = "status-badge";

  switch (stage) {
    case "idle":
    case "lost":
      return `${baseClass} ${baseClass}--idle`;
    case "acquiring":
      return `${baseClass} ${baseClass}--acquiring`;
    case "tracking":
      return `${baseClass} ${baseClass}--tracking`;
    case "locked":
      return `${baseClass} ${baseClass}--locked`;
    case "degraded":
      return `${baseClass} ${baseClass}--degraded`;
    case "permission-denied":
    case "error":
      return `${baseClass} ${baseClass}--error`;
    default:
      return baseClass;
  }
}
