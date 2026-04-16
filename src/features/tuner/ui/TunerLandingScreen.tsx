import type { CSSProperties } from "react";
import { STANDARD_GUITAR_TUNING } from "../../../lib/music";
import type { AudioInputDevice } from "../../../lib/audio";
import { DebugReadoutCard, type DebugReadoutData } from "../../../components/DebugReadoutCard";
import { DeveloperLogConsole } from "../../../components/DeveloperLogConsole";
import { EnhancedDebugPanel } from "../../../components/EnhancedDebugPanel";
import { PageShell } from "../../../components/PageShell";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { StatusCard } from "../../../components/StatusCard";
import type { TunerState, TunerUiStatus, TuningStringId } from "../../../types/tuner";
import type {
  PitchTrackingState,
  RawPitchCandidate,
  TuningInterpretation,
  TunerViewModel,
} from "../../../types/pitchTracking";
import type { DeveloperLogEntry } from "../../../lib/logging/developerLogger";
import {
  adaptViewModelToDisplay,
  shouldShowDegradedWarning,
  shouldShowSuccessPanel,
} from "./TunerDisplayAdapter";
import { createEmptyViewModel } from "../model/tunerViewModel";

type M1Prompt = {
  key: TunerUiStatus | "permission-prompt";
  label: string;
  title: string;
  description: string;
  hint?: string;
  tone?: "neutral" | "info" | "warning" | "error";
};

type HeroPanelContent = {
  readonly noteLabel: string;
  readonly targetLabel: string;
  readonly centsLabel: string;
  readonly frequencyLabel: string;
  readonly instruction: string;
  readonly meterLabel: string;
  readonly meterTone: "idle" | "warning" | "active" | "success";
};

type RescueCardContent = {
  readonly show: boolean;
  readonly title: string;
  readonly description: string;
  readonly steps: readonly string[];
  readonly tone: "warning" | "info" | "success";
};

type LiveStateContent = {
  readonly label: string;
  readonly detail: string;
  readonly tone: "idle" | "active" | "warning" | "success";
};

const M1_PROMPTS: M1Prompt[] = [
  {
    key: "idle",
    label: "\u5f53\u524d\u72b6\u6001",
    title: "\u51c6\u5907\u5f00\u59cb",
    description:
      "\u70b9\u51fb\u201c\u5f00\u59cb\u8c03\u97f3\u201d\u540e\u8fdb\u5165\u6388\u6743\u6d41\u7a0b\uff0c\u968f\u540e\u4f1a\u63d0\u793a\u4f60\u5355\u72ec\u62e8\u52a8\u4e00\u6839\u7434\u5f26\u3002",
    hint: "\u5efa\u8bae\u5728\u76f8\u5bf9\u5b89\u9759\u7684\u73af\u5883\u4e2d\u4f7f\u7528\uff0c\u5e76\u8ba9\u7434\u5934\u9760\u8fd1\u8bbe\u5907\u9ea6\u514b\u98ce\u3002",
    tone: "info",
  },
  {
    key: "permission-prompt",
    label: "\u6743\u9650\u63d0\u793a",
    title: "\u7b49\u5f85\u9ea6\u514b\u98ce\u6388\u6743",
    description:
      "\u5982\u679c\u6d4f\u89c8\u5668\u5f39\u51fa\u6743\u9650\u7a97\u53e3\uff0c\u8bf7\u9009\u62e9\u5141\u8bb8\u3002\u82e5\u672a\u770b\u5230\u5f39\u7a97\uff0c\u8bf7\u68c0\u67e5\u5730\u5740\u680f\u9644\u8fd1\u7684\u6743\u9650\u63d0\u793a\u3002",
    tone: "neutral",
  },
];

function getPromptFromState(state: TunerState): M1Prompt {
  switch (state.uiStatus) {
    case "requesting-permission":
      return {
        key: "requesting-permission",
        label: "\u5f53\u524d\u72b6\u6001",
        title: "\u7b49\u5f85\u9ea6\u514b\u98ce\u6388\u6743",
        description:
          "\u6d4f\u89c8\u5668\u6b63\u5728\u8bf7\u6c42\u9ea6\u514b\u98ce\u6743\u9650\u3002\u5982\u679c\u6ca1\u6709\u770b\u5230\u5f39\u7a97\uff0c\u8bf7\u68c0\u67e5\u5730\u5740\u680f\u9644\u8fd1\u7684\u6743\u9650\u63d0\u793a\u3002",
        hint: "\u6388\u6743\u6210\u529f\u540e\u4f1a\u7acb\u5373\u8fdb\u5165\u76d1\u542c\u51c6\u5907\u72b6\u6001\u3002",
        tone: "info",
      };
    case "permission-denied":
      return {
        key: "permission-denied",
        label: "\u5f53\u524d\u72b6\u6001",
        title: "\u9ea6\u514b\u98ce\u6743\u9650\u88ab\u62d2\u7edd",
        description:
          state.lastError?.message ??
          "\u8bf7\u5728\u6d4f\u89c8\u5668\u8bbe\u7f6e\u4e2d\u91cd\u65b0\u5141\u8bb8\u9ea6\u514b\u98ce\u8bbf\u95ee\u3002",
        hint: "\u8bf7\u786e\u8ba4\u5f53\u524d\u9875\u9762\u8fd0\u884c\u5728 localhost \u6216 HTTPS \u73af\u5883\u4e0b\u3002",
        tone: "error",
      };
    case "listening":
      return {
        key: "listening",
        label: "\u5f53\u524d\u72b6\u6001",
        title: "\u5df2\u5f00\u59cb\u76d1\u542c",
        description:
          "\u9ea6\u514b\u98ce\u548c AudioContext \u5df2\u7ecf\u5c31\u7eea\uff0c\u6b63\u5728\u7b49\u5f85\u6709\u6548\u7684\u5355\u97f3\u8f93\u5165\u3002",
        hint: "\u8bf7\u5355\u72ec\u62e8\u52a8\u4e00\u6839\u7434\u5f26\uff0c\u8ba9\u7434\u5934\u5c3d\u91cf\u9760\u8fd1\u9ea6\u514b\u98ce\u3002",
        tone: "info",
      };
    case "no-signal":
      return {
        key: "no-signal",
        label: "\u5f53\u524d\u72b6\u6001",
        title: "\u6709\u8f93\u5165\uff0c\u4f46\u8fd8\u65e0\u6cd5\u9501\u5b9a\u97f3\u9ad8",
        description:
          "\u9875\u9762\u5df2\u7ecf\u542c\u5230\u6bd4\u8f83\u660e\u663e\u7684\u58f0\u97f3\uff0c\u4f46\u8fd9\u4e2a\u65f6\u523b\u8fd8\u4e0d\u8db3\u4ee5\u7a33\u5b9a\u89e3\u51fa\u5355\u97f3\u97f3\u9ad8\u3002",
        hint: "\u5c3d\u91cf\u53ea\u62e8\u4e00\u6839\u5f26\uff0c\u907f\u514d\u540c\u65f6\u5f15\u5165\u73af\u5883\u566a\u58f0\u6216\u5176\u4ed6\u5f26\u7684\u5171\u632f\u3002",
        tone: "warning",
      };
    case "signal-weak":
      return {
        key: "signal-weak",
        label: "\u5f53\u524d\u72b6\u6001",
        title: "\u5df2\u542c\u5230\u5fae\u5f31\u8f93\u5165",
        description:
          "\u9ea6\u514b\u98ce\u5df2\u7ecf\u6536\u5230\u4e00\u70b9\u58f0\u97f3\uff0c\u4f46\u8fd8\u4e0d\u591f\u5f3a\uff0c\u56e0\u6b64\u5f88\u96be\u5feb\u901f\u9501\u5b9a\u97f3\u9ad8\u3002",
        hint: "\u628a\u5409\u4ed6\u66f4\u9760\u8fd1\u9ea6\u514b\u98ce\uff0c\u6216\u8005\u62e8\u5f26\u66f4\u6e05\u695a\u3001\u5ef6\u97f3\u7a0d\u5fae\u66f4\u957f\u4e00\u70b9\u3002",
        tone: "warning",
      };
    case "detecting":
      return {
        key: "detecting",
        label: "\u5f53\u524d\u72b6\u6001",
        title: "\u6b63\u5728\u8f93\u51fa\u5019\u9009\u97f3\u9ad8",
        description:
          "\u5f53\u524d\u68c0\u6d4b\u94fe\u8def\u5df2\u7ecf\u5f00\u59cb\u8fd4\u56de\u9891\u7387\u5019\u9009\u503c\uff0c\u6b63\u5728\u89c2\u5bdf\u7ed3\u679c\u662f\u5426\u80fd\u7ee7\u7eed\u6536\u655b\u3002",
        hint: "\u8c03\u8bd5\u9762\u677f\u4f1a\u663e\u793a frequency\u3001note\u3001cents \u548c target string\u3002",
        tone: "info",
      };
    case "unstable":
      return {
        key: "unstable",
        label: "\u5f53\u524d\u72b6\u6001",
        title: "\u68c0\u6d4b\u5230\u97f3\u9ad8\uff0c\u4f46\u8fd8\u4e0d\u7a33\u5b9a",
        description:
          "\u5f53\u524d\u5019\u9009\u503c\u5728\u53d8\u5316\uff0c\u8fd8\u6ca1\u6709\u8fbe\u5230\u53ef\u9760\u7684\u7a33\u5b9a\u7a97\u53e3\u3002",
        hint: "\u8fd9\u6b63\u662f M2 \u9700\u8981\u9a8c\u8bc1\u7684\u90e8\u5206\uff1a\u4f4e E \u5230\u9ad8 E \u7684\u771f\u5b9e\u8bbe\u5907\u7a33\u5b9a\u6027\u3002",
        tone: "warning",
      };
    case "in-tune":
      return {
        key: "in-tune",
        label: "\u5f53\u524d\u72b6\u6001",
        title: "\u5df2\u8fdb\u5165\u8c03\u51c6\u533a\u95f4",
        description:
          "\u5f53\u524d\u7a33\u5b9a\u5316\u7ed3\u679c\u8ba4\u4e3a\u97f3\u9ad8\u5df2\u63a5\u8fd1\u76ee\u6807\u5f26\u3002",
        hint: "\u540e\u7eed\u4f1a\u7ee7\u7eed\u7528\u66f4\u591a\u5b9e\u9a8c\u6765\u8c03\u6574 thresholds \u548c UI \u53cd\u9988\u8282\u594f\u3002",
        tone: "info",
      };
    case "error":
      return {
        key: "error",
        label: "\u5f53\u524d\u72b6\u6001",
        title: "\u97f3\u9891\u521d\u59cb\u5316\u5931\u8d25",
        description:
          state.lastError?.message ??
          "\u521d\u59cb\u5316\u97f3\u9891\u65f6\u51fa\u73b0\u9519\u8bef\uff0c\u8bf7\u5237\u65b0\u9875\u9762\u540e\u91cd\u8bd5\u3002",
        hint: "\u5982\u95ee\u9898\u6301\u7eed\u5b58\u5728\uff0c\u8bf7\u5148\u786e\u8ba4\u6d4f\u89c8\u5668\u662f\u5426\u652f\u6301\u9ea6\u514b\u98ce\u548c AudioContext\u3002",
        tone: "error",
      };
    default:
      return M1_PROMPTS[0];
  }
}

type TunerLandingScreenProps = {
  state: TunerState;
  rawCandidate?: RawPitchCandidate | null;
  trackingState?: PitchTrackingState | null;
  interpretation?: TuningInterpretation | null;
  viewModel?: TunerViewModel | null;
  isStarting: boolean;
  onStart: () => void | Promise<void>;
  onReset: () => void | Promise<void>;
  onRefreshInputs: () => void | Promise<unknown>;
  onSelectInput: (deviceId: string) => void | Promise<void>;
  onEnableAutoTargetMode: () => void;
  onSelectManualTarget: (targetId: TuningStringId) => void;
  debugReadout?: DebugReadoutData;
  developerLogs?: readonly DeveloperLogEntry[];
  availableInputs?: readonly AudioInputDevice[];
  selectedInputDeviceId?: string | null;
  activeInputLabel?: string | null;
};

function getFallbackTargetLabel(state: TunerState) {
  if (state.activeTarget) {
    return `${state.activeTarget.label} / ${state.activeTarget.note}${state.activeTarget.octave}`;
  }

  if (state.selection.targetId) {
    return state.selection.targetId;
  }

  return state.selection.mode === "auto" ? "Auto" : null;
}

function buildDebugReadout(state: TunerState, override?: DebugReadoutData): DebugReadoutData {
  const reading = state.stabilizedPitch ?? state.detectedPitch;

  return {
    audioStatus: override?.audioStatus ?? state.audioStatus,
    frequencyHz: override?.frequencyHz ?? reading?.frequencyHz ?? null,
    noteLabel:
      override?.noteLabel ??
      (state.activeTarget ? `${state.activeTarget.note}${state.activeTarget.octave}` : null),
    cents: override?.cents ?? state.deviation?.cents ?? null,
    targetLabel: override?.targetLabel ?? getFallbackTargetLabel(state),
    clarity: override?.clarity ?? reading?.clarity ?? null,
    sampleCount: override?.sampleCount ?? state.stabilizedPitch?.sampleCount ?? null,
    source: override?.source ?? reading?.source ?? null,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mapCentsToNeedleOffset(cents: number | null) {
  if (typeof cents !== "number" || Number.isNaN(cents)) {
    return 0;
  }

  // Expand the visually important tuning zone so small pitch errors are readable.
  const normalized = clamp(cents / 15, -1, 1);
  const eased = Math.sign(normalized) * Math.sqrt(Math.abs(normalized));
  return eased * 42;
}

function getInputMeterState(frameRms: number | null | undefined) {
  const safeRms = typeof frameRms === "number" ? frameRms : 0;
  const normalized = clamp(safeRms / 0.03, 0, 1);

  if (safeRms <= 0.0008) {
    return {
      level: normalized,
      label: "No microphone input detected. Check the selected input device or system recording source.",
      tone: "warning" as const,
    };
  }

  if (safeRms <= 0.003) {
    return {
      level: normalized,
      label: "Input is very weak. Move the guitar closer or choose the correct microphone.",
      tone: "idle" as const,
    };
  }

  return {
    level: normalized,
    label: "Input level looks healthy.",
    tone: "active" as const,
  };
}

function buildHeroPanelContent(state: TunerState, debugReadout: DebugReadoutData): HeroPanelContent {
  const reading = state.stabilizedPitch ?? state.detectedPitch;
  const activeTarget = state.activeTarget;
  const noteLabel =
    reading?.noteName && typeof reading.octave === "number"
      ? `${reading.noteName}${reading.octave}`
      : activeTarget
        ? `${activeTarget.note}${activeTarget.octave}`
        : "--";
  const resolvedTargetLabel = activeTarget ? `${activeTarget.note}${activeTarget.octave} · String ${activeTarget.label}` : "Auto target";
  const centsValue = state.deviation?.cents ?? reading?.cents ?? null;
  const centsLabel =
    typeof centsValue === "number"
      ? `${centsValue > 0 ? "+" : ""}${centsValue.toFixed(1)} cent`
      : "Pluck a single string";
  const frequencyLabel =
    typeof reading?.frequencyHz === "number" ? `${reading.frequencyHz.toFixed(2)} Hz` : "Waiting for pitch";
  const inputMeter = getInputMeterState(debugReadout.frameRms);

  if (state.uiStatus === "in-tune") {
    return {
      noteLabel,
      targetLabel: resolvedTargetLabel,
      centsLabel,
      frequencyLabel,
      instruction: "In tune. Let the note ring and make tiny adjustments only if the needle drifts.",
      meterLabel: inputMeter.label,
      meterTone: "success",
    };
  }

  if (state.uiStatus === "no-signal") {
    return {
      noteLabel,
      targetLabel: resolvedTargetLabel,
      centsLabel,
      frequencyLabel,
      instruction: "We can hear something, but it is still too messy for a clean pitch lock. Pluck only one string and reduce extra noise.",
      meterLabel: inputMeter.label,
      meterTone: inputMeter.tone,
    };
  }

  if (state.uiStatus === "signal-weak") {
    return {
      noteLabel,
      targetLabel: resolvedTargetLabel,
      centsLabel,
      frequencyLabel,
      instruction: "A little input is getting through, but not enough to tune comfortably yet. Move closer and pluck more clearly.",
      meterLabel: inputMeter.label,
      meterTone: inputMeter.tone,
    };
  }

  if (state.uiStatus === "detecting" || state.uiStatus === "unstable") {
    return {
      noteLabel,
      targetLabel: resolvedTargetLabel,
      centsLabel,
      frequencyLabel,
      instruction: "Pluck one string at a time and wait for the indicator to settle before tuning further.",
      meterLabel: inputMeter.label,
      meterTone: inputMeter.tone,
    };
  }

  return {
    noteLabel,
    targetLabel: resolvedTargetLabel,
    centsLabel,
    frequencyLabel,
    instruction: "Start tuning, then pluck one string clearly. The tuner will lock onto the closest standard guitar string.",
    meterLabel: inputMeter.label,
    meterTone: inputMeter.tone,
  };
}

function buildRescueCardContent(
  state: TunerState,
  frameRms: number | null | undefined,
  activeInputLabel: string | null,
): RescueCardContent {
  const safeRms = typeof frameRms === "number" ? frameRms : 0;

  if (state.uiStatus === "in-tune") {
    return {
      show: true,
      tone: "success",
      title: "Locked in",
      description: "The tuner considers this note close enough to the target. Hold the note and confirm the needle stays centered.",
      steps: [
        `Current source: ${activeInputLabel ?? "unknown microphone"}`,
        "Move to the next string only after the needle stays steady.",
      ],
    };
  }

  if (safeRms <= 0.0008 && state.audioStatus === "listening") {
    return {
      show: true,
      tone: "warning",
      title: "No usable microphone input",
      description: "The tuner is listening, but the incoming level is effectively zero. This usually means the wrong recording device is selected.",
      steps: [
        "Open the input source selector and try another microphone.",
        "Pluck the string again and watch whether the input meter rises.",
        "If every device stays silent, check your system recording source or browser microphone permission.",
      ],
    };
  }

  if (safeRms <= 0.003 && state.audioStatus === "listening") {
    return {
      show: true,
      tone: "info",
      title: "Input is too weak to tune comfortably",
      description: "A little sound is reaching the tuner, but not enough for reliable lock-on yet.",
      steps: [
        "Move the guitar closer to the selected microphone.",
        "Pluck one string harder and let it sustain a bit longer.",
        "Switch microphones if the meter stays weak on every pluck.",
      ],
    };
  }

  if (state.uiStatus === "no-signal") {
    return {
      show: true,
      tone: "warning",
      title: "Sound is coming in, but the pitch is unclear",
      description: "The tuner hears energy, yet the current note is too noisy or too blended to resolve into one stable pitch.",
      steps: [
        "Mute the other strings before plucking again.",
        "Let one note ring by itself instead of strumming.",
        "If the room is noisy, move closer to the microphone or change input devices.",
      ],
    };
  }

  return {
    show: false,
    tone: "info",
    title: "",
    description: "",
    steps: [],
  };
}

function buildLiveStateContent(state: TunerState, hasActivePitch: boolean): LiveStateContent {
  if (state.uiStatus === "in-tune") {
    return {
      label: "Pitch locked",
      detail: "Inside the tune window. Make only tiny adjustments if the note drifts.",
      tone: "success",
    };
  }

  if (state.uiStatus === "unstable" || state.uiStatus === "detecting") {
    return {
      label: "Tracking pitch",
      detail: "A note is present, but the tuner is still settling on a stable reading.",
      tone: "active",
    };
  }

  if (state.uiStatus === "signal-weak" || state.uiStatus === "no-signal") {
    return {
      label: "Need cleaner input",
      detail: "Pluck one string clearly and let it ring longer so the tuner can lock.",
      tone: "warning",
    };
  }

  if (hasActivePitch) {
    return {
      label: "Pitch detected",
      detail: "Reading is live. Watch the needle and adjust in small steps.",
      tone: "active",
    };
  }

  return {
    label: "Waiting for pitch",
    detail: "Pluck one string cleanly. The tuner will lock after it hears a stable note.",
    tone: "idle",
  };
}

export function TunerLandingScreen({
  state,
  rawCandidate = null,
  trackingState = null,
  interpretation = null,
  viewModel = null,
  isStarting,
  onStart,
  onReset,
  onRefreshInputs,
  onSelectInput,
  onEnableAutoTargetMode,
  onSelectManualTarget,
  debugReadout,
  developerLogs = [],
  availableInputs = [],
  selectedInputDeviceId = null,
  activeInputLabel = null,
}: TunerLandingScreenProps) {
  const resolvedViewModel = viewModel ?? createEmptyViewModel();
  const displayState = adaptViewModelToDisplay(resolvedViewModel, state);
  const currentPrompt = getPromptFromState(state);
  const resolvedDebugReadout = buildDebugReadout(state, debugReadout);
  const heroPanel = buildHeroPanelContent(state, resolvedDebugReadout);
  const liveReading = state.stabilizedPitch ?? state.detectedPitch;
  const trackedFrequencyHz = trackingState?.trackedFrequencyHz ?? rawCandidate?.frequencyHz ?? null;
  const hasActivePitch = typeof trackedFrequencyHz === "number";
  const detectedNoteLabel = displayState.displayNote;
  const detectedNoteStatus =
    resolvedViewModel.uiStage === "locked"
      ? "Locked reading"
      : resolvedViewModel.uiStage === "degraded"
        ? "Held reading"
        : resolvedViewModel.uiStage === "tracking" || resolvedViewModel.uiStage === "acquiring"
          ? "Live reading"
          : "Waiting for pitch";
  const targetNoteLabel = displayState.displayTarget ?? "Auto";
  const targetStatus = displayState.stageLabel;
  const confidenceLabel =
    typeof trackingState?.confidence === "number"
      ? `${Math.round(trackingState.confidence * 100)}% confidence`
      : typeof rawCandidate?.clarity === "number"
        ? `${Math.round(rawCandidate.clarity * 100)}% clarity`
        : "Confidence --";
  const sampleLabel =
    trackingState ? `${trackingState.stage} stage` : "Stage --";
  const isListening =
    state.audioStatus === "listening" || state.audioStatus === "ready" || state.audioStatus === "suspended";
  const canResetSession =
    state.audioStatus !== "idle" && state.audioStatus !== "requesting-permission";
  const centsValue = interpretation?.centsOffset ?? resolvedViewModel.needlePosition * 50;
  const needleOffset = displayState.needleActive ? mapCentsToNeedleOffset(centsValue) : 0;
  const inputMeter = getInputMeterState(resolvedDebugReadout.frameRms);
  const rescueCard = buildRescueCardContent(state, resolvedDebugReadout.frameRms, activeInputLabel);
  const showDeviceRecoveryHint = inputMeter.tone !== "active" || availableInputs.length === 0;
  const directionLabel = hasActivePitch ? displayState.statusMessage : "No pitch lock";
  const isManualMode = state.selection.mode === "manual";
  const activeManualTarget = STANDARD_GUITAR_TUNING.find((target) => target.id === state.selection.targetId) ?? null;
  const showSuccessPanel = shouldShowSuccessPanel(resolvedViewModel) && hasActivePitch;
  const showDegradedWarning = shouldShowDegradedWarning(resolvedViewModel);
  const targetNoteCode = state.activeTarget ? `${state.activeTarget.note}${state.activeTarget.octave}` : null;
  const noteMatchesTarget =
    !interpretation?.targetId || !targetNoteCode || interpretation.detectedNote === targetNoteCode;
  const closenessPercent =
    typeof centsValue === "number" ? Math.round((1 - clamp(Math.abs(centsValue) / 25, 0, 1)) * 100) : 0;
  const tuningCoachTitle = !hasActivePitch
    ? "No stable pitch yet"
    : resolvedViewModel.uiStage === "acquiring"
      ? "Listening for a stable note"
      : resolvedViewModel.uiStage === "tracking"
        ? "Following the note without locking a target yet"
        : resolvedViewModel.uiStage === "degraded"
          ? "Signal is fading"
          : !noteMatchesTarget
      ? "You are on a different note than the current target"
      : displayState.showSuccess
        ? "This string is inside the tune window"
        : centsValue < 0
          ? "Bring the pitch up slowly"
          : centsValue > 0
            ? "Back the pitch down slowly"
            : "Keep the note ringing";
  const tuningCoachBody = !hasActivePitch
    ? "Pluck one string by itself and let it sustain long enough for the tuner to lock."
    : resolvedViewModel.uiStage === "acquiring"
      ? "The tuner has a candidate, but it is not stable enough to name a target string yet."
      : resolvedViewModel.uiStage === "tracking"
        ? "Continuity is forming, but auto target selection is still being held back until the note settles."
        : resolvedViewModel.uiStage === "degraded"
          ? "Tracking is still active, but the sustain is weakening. Re-pluck if the signal keeps fading."
          : !noteMatchesTarget
      ? `Detected ${detectedNoteLabel}, but the target is ${targetNoteLabel}. Re-pluck one isolated string before adjusting.`
      : displayState.showSuccess
        ? "Hold the note steady. If the needle stays centered, move on to the next string."
        : `Current offset is ${displayState.displayCents}. Use small adjustments and re-pluck after each change.`;
  const tuningCoachTone = !hasActivePitch
    ? "idle"
    : !noteMatchesTarget || showDegradedWarning
      ? "warning"
      : displayState.showSuccess
        ? "success"
        : "active";
  const liveState = buildLiveStateContent(state, hasActivePitch);
  const successHeadline = state.activeTarget
    ? `String ${state.activeTarget.label} is in tune`
    : "Current string is in tune";
  const successTrustLabel =
    inputMeter.tone === "active" && typeof trackingState?.confidence === "number" && trackingState.confidence >= 0.9
      ? "Strong lock"
      : inputMeter.tone === "warning"
        ? "Tune looks right, but input is weak"
        : "Hold and re-pluck once to confirm";

  return (
    <PageShell
      eyebrow="Web M2 Validation"
      title="Noobty Tune"
      description="\u5728\u6d4f\u89c8\u5668\u91cc\u5feb\u901f\u7ed9\u5409\u4ed6\u8c03\u97f3\u3002\u70b9\u51fb\u5f00\u59cb\u540e\uff0c\u6211\u4eec\u4f1a\u8bf7\u6c42\u9ea6\u514b\u98ce\u6743\u9650\u3002"
    >
      <div className="tuner-launch-panel">
        <div
          className="trust-note"
          aria-label="\u672c\u5730\u5904\u7406\u8bf4\u660e"
        >
          {"\u97f3\u9891\u4ec5\u5728\u6d4f\u89c8\u5668\u672c\u5730\u5904\u7406\uff0c\u4e0d\u4f1a\u5728\u9875\u9762\u52a0\u8f7d\u65f6\u81ea\u52a8\u8bf7\u6c42\u6743\u9650\u3002"}
        </div>

        <section className="tuner-stage" aria-labelledby="tuner-stage-title">
          <div className="tuner-stage-header">
            <div>
              <p className="tuner-stage-kicker">Live tuner</p>
              <h2 id="tuner-stage-title" className="tuner-stage-title">
                Tune by ear, read by glance
              </h2>
            </div>
            <div className={`signal-pill signal-pill--${inputMeter.tone}`}>
              {inputMeter.level > 0.2 ? "Input active" : "Input weak"}
            </div>
          </div>

          <div className="tuner-primary-readout">
            <div className="note-orb" aria-live="polite">
              <div className="note-orb-header">
                <span className="note-orb-kicker">Detected note</span>
                <span className="note-orb-status">{detectedNoteStatus}</span>
              </div>
              <div className={`active-target-banner ${state.activeTarget ? "active-target-banner--locked" : ""}`}>
                <span className="active-target-banner-label">Current target string</span>
                <strong>
                  {state.activeTarget
                    ? `String ${state.activeTarget.label} - ${state.activeTarget.note}${state.activeTarget.octave}`
                    : "Auto target will lock after a clean pluck"}
                </strong>
              </div>
              <span className="note-orb-note">{detectedNoteLabel}</span>
              <div className="note-orb-meta-grid">
                <div className="note-orb-meta-card">
                  <span className="note-orb-meta-label">Target</span>
                  <strong>{targetNoteLabel}</strong>
                  <span className="note-orb-meta-copy">{targetStatus}</span>
                </div>
                <div className="note-orb-meta-card">
                  <span className="note-orb-meta-label">Live pitch</span>
                  <strong>{heroPanel.frequencyLabel}</strong>
                  <span className="note-orb-meta-copy">{heroPanel.centsLabel}</span>
                </div>
              </div>
              <p className="note-orb-meta-inline">
                Reading quality: {confidenceLabel} · {sampleLabel}
              </p>
            </div>

            <div className="tuner-needle-panel" aria-label="pitch deviation meter">
              <div className={`live-state-banner live-state-banner--${liveState.tone}`} aria-live="polite">
                <div className="live-state-copy">
                  <span className="live-state-label">{liveState.label}</span>
                  <p>{liveState.detail}</p>
                </div>
                <span className={`live-state-pulse live-state-pulse--${liveState.tone}`} aria-hidden="true" />
              </div>
              <div className="tuner-direction-row" aria-hidden="true">
                <span>Flat</span>
                <span>In tune</span>
                <span>Sharp</span>
              </div>
              <div className="tuner-scale">
                <div className="tuner-scale-center" />
                <div
                  className={`tuner-needle ${state.uiStatus === "in-tune" ? "tuner-needle--success" : ""} ${!hasActivePitch ? "tuner-needle--idle" : ""}`}
                  style={{ "--needle-offset": `${needleOffset}%` } as CSSProperties}
                />
                {!hasActivePitch ? (
                  <div className="tuner-scale-overlay" aria-live="polite">
                    <strong>No pitch lock yet</strong>
                    <span>Pluck one string cleanly and let it ring</span>
                  </div>
                ) : null}
                <div className="tuner-ticks" aria-hidden="true">
                  {[-50, -25, 0, 25, 50].map((value) => (
                    <span key={value} className={value === 0 ? "is-center" : undefined} />
                  ))}
                </div>
              </div>
              <div className="tuner-window-row" aria-hidden="true">
                <span>Loose</span>
                <strong>Center zone = tune window ±5 cent</strong>
                <span>Loose</span>
              </div>
              <div className="tuner-metric-row">
                <strong>{hasActivePitch ? heroPanel.centsLabel : "Waiting for cents"}</strong>
                <span>{hasActivePitch ? heroPanel.frequencyLabel : "Waiting for pitch"}</span>
              </div>
              <div className={`direction-chip direction-chip--${state.deviation?.direction ?? "idle"}`}>
                {hasActivePitch ? directionLabel : "No pitch lock"}
              </div>
              {showSuccessPanel ? (
                <div className="tune-success-panel" aria-live="polite">
                  <div className="tune-success-copy">
                    <span className="tune-success-kicker">Tune confirmed</span>
                    <strong>{successHeadline}</strong>
                    <p>The needle is inside the tune window. Let the note ring once more, then move to the next string.</p>
                  </div>
                  <div className="tune-success-stats">
                    <span>{successTrustLabel}</span>
                    <span>{heroPanel.centsLabel}</span>
                    <span>{state.activeTarget ? `Next: move on from String ${state.activeTarget.label}` : heroPanel.frequencyLabel}</span>
                  </div>
                </div>
              ) : null}
              <div className={`tuning-coach tuning-coach--${tuningCoachTone}`}>
                <div className="tuning-coach-copy">
                  <span className="tuning-coach-kicker">Tuning coach</span>
                  <strong>{tuningCoachTitle}</strong>
                  <p>{tuningCoachBody}</p>
                </div>
                <div className="tuning-coach-meter" aria-label="closeness to tune">
                  <div className="tuning-coach-scale">
                    <span
                      className={`tuning-coach-fill ${state.uiStatus === "in-tune" ? "tuning-coach-fill--success" : ""}`}
                      style={{ width: `${hasActivePitch ? Math.max(closenessPercent, 8) : 0}%` }}
                    />
                  </div>
                  <div className="tuning-coach-labels">
                    <span>Far</span>
                    <span>Near</span>
                    <span>Locked</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="tuner-guidance">{heroPanel.instruction}</p>
          <div className={`live-state-banner live-state-banner--${displayState.coachTone}`} aria-live="polite">
            <div className="live-state-copy">
              <span className="live-state-label">{displayState.coachTitle}</span>
              <p>{displayState.coachBody}</p>
            </div>
            <span className={`live-state-pulse live-state-pulse--${displayState.coachTone}`} aria-hidden="true" />
          </div>
          {showDegradedWarning ? (
            <section className="rescue-card rescue-card--warning" aria-live="polite">
              <div className="rescue-card-header">
                <p className="rescue-card-kicker">Tracking state</p>
                <h3 className="rescue-card-title">Signal is fading, but tracking is still active</h3>
              </div>
              <p className="rescue-card-description">
                The tuner is holding the last stable track instead of dropping the reading immediately.
              </p>
            </section>
          ) : null}

          <details
            className={`target-mode-panel ${isManualMode ? "target-mode-panel--manual" : "target-mode-panel--auto"}`}
            open={isManualMode}
          >
            <summary className="target-mode-summary-row">
              <div>
                <p className="target-mode-kicker">Advanced targeting</p>
                <h3 id="target-mode-title" className="target-mode-title">
                  Auto target stays on by default
                </h3>
                <p className="target-mode-summary">
                  {isManualMode
                    ? `Manual lock is active on String ${activeManualTarget?.label ?? "--"} ${activeManualTarget ? `(${activeManualTarget.note}${activeManualTarget.octave})` : ""}.`
                    : "Open this only if you need to force the tuner to follow one specific string."}
                </p>
              </div>
              <div className="target-mode-badges" aria-label="targeting mode badges">
                <span className="target-mode-badge target-mode-badge--recommended">Auto default</span>
                {isManualMode ? <span className="target-mode-badge target-mode-badge--manual">Manual active</span> : null}
              </div>
            </summary>

            <div className="target-mode-content">
              <div className="target-mode-actions">
                <button
                  type="button"
                  className={`mode-chip ${state.selection.mode === "auto" ? "mode-chip--active" : ""}`}
                  onClick={onEnableAutoTargetMode}
                >
                  Use auto target
                </button>
                <button
                  type="button"
                  className={`mode-chip mode-chip--subtle ${state.selection.mode === "manual" ? "mode-chip--active" : ""}`}
                  onClick={() => {
                    onSelectManualTarget(state.selection.targetId ?? "string-6");
                  }}
                >
                  {isManualMode ? "Change locked string" : "Enable manual lock"}
                </button>
              </div>

              <div className="manual-target-grid">
                {STANDARD_GUITAR_TUNING.map((target) => {
                  const isManualActive = state.selection.mode === "manual" && state.selection.targetId === target.id;
                  return (
                    <button
                      key={target.id}
                      type="button"
                      className={`manual-target-pill ${isManualActive ? "manual-target-pill--active" : ""}`}
                      onClick={() => {
                        onSelectManualTarget(target.id);
                      }}
                    >
                      <span>String {target.label}</span>
                      <strong>
                        {target.note}
                        {target.octave}
                      </strong>
                    </button>
                  );
                })}
              </div>
            </div>
          </details>

          {rescueCard.show && rescueCard.tone !== "success" ? (
            <section className={`rescue-card rescue-card--${rescueCard.tone}`} aria-live="polite">
              <div className="rescue-card-header">
                <p className="rescue-card-kicker">Tuning help</p>
                <h3 className="rescue-card-title">{rescueCard.title}</h3>
              </div>
              <p className="rescue-card-description">{rescueCard.description}</p>
              <div className="rescue-card-steps">
                {rescueCard.steps.map((step) => (
                  <p key={step}>{step}</p>
                ))}
              </div>
            </section>
          ) : null}

          <div className="input-health-panel" role="status" aria-live="polite">
            <div className="input-health-copy">
              <p className="input-health-label">Microphone input</p>
              <p className="input-health-message">{heroPanel.meterLabel}</p>
              <p className="input-health-source">
                Active source: <strong>{activeInputLabel ?? "Not listening yet"}</strong>
              </p>
            </div>
            <div className="input-level-track" aria-hidden="true">
              <span
                className={`input-level-fill input-level-fill--${inputMeter.tone}`}
                style={{ width: `${Math.max(inputMeter.level * 100, inputMeter.level > 0 ? 8 : 0)}%` }}
              />
            </div>
            {showDeviceRecoveryHint ? (
              <p className="input-health-hint">
                If this stays weak, open microphone settings below and switch to another input.
              </p>
            ) : null}
          </div>

          <section className="string-target-section" aria-labelledby="string-target-section-title">
            <div className="string-target-header">
              <div>
                <p className="string-target-kicker">Target rail</p>
                <h3 id="string-target-section-title" className="string-target-title">
                  The highlighted string is the one the tuner is following
                </h3>
              </div>
              <span className="string-target-summary">
                {state.activeTarget
                  ? `Locked on String ${state.activeTarget.label}`
                  : "Waiting for a clean note"}
              </span>
            </div>
            <div className="string-target-strip" aria-label="standard tuning targets">
            {STANDARD_GUITAR_TUNING.map((target) => {
              const isActive = state.activeTarget?.id === target.id;
              return (
                <div
                  key={target.id}
                  className={`string-target-pill ${isActive ? "string-target-pill--active" : ""}`}
                >
                  <span className="string-target-index">String {target.label}</span>
                  <strong>
                    {target.note}
                    {target.octave}
                  </strong>
                  <small>{isActive ? "Following now" : "Standby"}</small>
                </div>
              );
            })}
            </div>
          </section>

          <details className="device-panel" open={showDeviceRecoveryHint}>
            <summary className="device-panel-summary">
              <div>
                <p className="device-panel-kicker">Microphone settings</p>
                <h3 id="device-panel-title" className="device-panel-title">
                  Switch input only if the meter stays weak or silent
                </h3>
              </div>
              <span className="device-panel-summary-copy">
                {showDeviceRecoveryHint ? "Recovery step recommended" : "Usually no change needed"}
              </span>
            </summary>

            <div className="device-panel-content">
              <div className="device-panel-actions">
                <button
                  type="button"
                  className="device-refresh-button"
                  onClick={() => {
                    void onRefreshInputs();
                  }}
                >
                  Refresh list
                </button>
              </div>

              <div className="device-panel-grid">
                <label className="device-select-field">
                  <span className="device-select-label">Available microphones</span>
                  <select
                    className="device-select"
                    value={selectedInputDeviceId ?? ""}
                    onChange={(event) => {
                      void onSelectInput(event.target.value);
                    }}
                    disabled={availableInputs.length === 0}
                  >
                    {availableInputs.length === 0 ? (
                      <option value="">No microphone detected yet</option>
                    ) : null}
                    {availableInputs.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="device-active-card">
                  <span className="device-select-label">Current active source</span>
                  <strong>{activeInputLabel ?? "Not listening yet"}</strong>
                  <p>
                    If the input meter stays near zero, switch to another microphone and pluck again.
                  </p>
                </div>
              </div>
            </div>
          </details>
        </section>

        <div className="primary-actions">
          <PrimaryButton
            aria-describedby="permission-note"
            className="tuner-launch-button"
            disabled={isStarting || isListening}
            onClick={() => {
              void onStart();
            }}
          >
            {isStarting
              ? "\u8bf7\u6c42\u6743\u9650\u4e2d..."
              : isListening
                ? "\u6b63\u5728\u76d1\u542c"
                : "\u5f00\u59cb\u8c03\u97f3"}
          </PrimaryButton>

          {canResetSession ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void onReset();
              }}
            >
              {"\u91cd\u7f6e\u4f1a\u8bdd"}
            </button>
          ) : null}
        </div>

        <p id="permission-note" className="permission-note">
          {"\u4ec5\u5728\u4f60\u4e3b\u52a8\u70b9\u51fb\u540e\u8bf7\u6c42\u9ea6\u514b\u98ce\u6743\u9650\u3002\u6388\u6743\u6210\u529f\u540e\uff0c\u4f1a\u8fdb\u5165\u76d1\u542c\u51c6\u5907\u72b6\u6001\u3002"}
        </p>

        <details className="status-stack">
          <summary className="status-stack-summary">Session notes and validation context</summary>
          <div className="status-stack-panels" aria-label="\u8c03\u97f3\u5668\u72b6\u6001\u63d0\u793a">
            <StatusCard
              key={currentPrompt.key}
              label={currentPrompt.label}
              title={currentPrompt.title}
              description={currentPrompt.description}
              hint={currentPrompt.hint}
              tone={currentPrompt.tone}
            />
            <StatusCard
              label="\u4e0b\u4e00\u6b65"
              title="M3 tuning UX closure in progress"
              description="This panel keeps the current validation context available without competing with the main tuning flow."
              hint="Use it when you want to understand session state, permission state, or validation-stage notes."
              tone="neutral"
            />
          </div>
        </details>

        <details className="developer-tools">
          <summary>Developer tools</summary>
          <div className="developer-tools-stack">
            <DebugReadoutCard data={resolvedDebugReadout} />
            <EnhancedDebugPanel
              rawCandidate={rawCandidate}
              trackingState={trackingState}
              interpretation={interpretation}
              viewModel={resolvedViewModel}
              frameRms={resolvedDebugReadout.frameRms}
            />
            <DeveloperLogConsole logs={developerLogs} />
          </div>
        </details>
      </div>
    </PageShell>
  );
}
