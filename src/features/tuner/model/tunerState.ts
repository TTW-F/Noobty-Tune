import {
  DEFAULT_TUNING_ID,
  createDeviationFromCents,
  findClosestTuningTarget,
  getCentsOffset,
} from "../../../lib/music";
import type {
  PitchReading,
  StabilizedPitchReading,
  TunerDeviation,
  TunerEngineError,
  TunerSelection,
  TunerState,
  TuningTarget,
} from "../../../types/tuner";

export const DEFAULT_TUNER_SELECTION: TunerSelection = {
  tuningId: DEFAULT_TUNING_ID,
  mode: "auto",
  targetId: null,
};

export const INITIAL_TUNER_STATE: TunerState = {
  audioStatus: "idle",
  uiStatus: "idle",
  selection: DEFAULT_TUNER_SELECTION,
  activeTarget: null,
  detectedPitch: null,
  stabilizedPitch: null,
  deviation: null,
  lastError: null,
};

export interface TunerSnapshotInput {
  readonly audioStatus?: TunerState["audioStatus"];
  readonly uiStatus?: TunerState["uiStatus"];
  readonly selection?: TunerSelection;
  readonly activeTarget?: TuningTarget | null;
  readonly detectedPitch?: PitchReading | null;
  readonly stabilizedPitch?: StabilizedPitchReading | null;
  readonly deviation?: TunerDeviation | null;
  readonly lastError?: TunerEngineError | null;
}

export function createTunerStateSnapshot(input: TunerSnapshotInput = {}): TunerState {
  return {
    ...INITIAL_TUNER_STATE,
    ...input,
  };
}

export function getSelectedTarget(
  selection: TunerSelection,
  targets: readonly TuningTarget[],
): TuningTarget | null {
  if (selection.mode === "manual" && selection.targetId) {
    return targets.find((target) => target.id === selection.targetId) ?? null;
  }

  return null;
}

export function createPermissionDeniedState(error: TunerEngineError): TunerState {
  return createTunerStateSnapshot({
    audioStatus: "permission-denied",
    uiStatus: "permission-denied",
    lastError: error,
  });
}

export function createListeningState(input: {
  activeTarget?: TuningTarget | null;
  detectedPitch?: PitchReading | null;
  stabilizedPitch?: StabilizedPitchReading | null;
  deviation?: TunerDeviation | null;
} = {}): TunerState {
  return createTunerStateSnapshot({
    audioStatus: "listening",
    uiStatus: "listening",
    activeTarget: input.activeTarget ?? null,
    detectedPitch: input.detectedPitch ?? null,
    stabilizedPitch: input.stabilizedPitch ?? null,
    deviation: input.deviation ?? null,
  });
}

export function resolveActiveTarget(
  selection: TunerSelection,
  detectedPitch: PitchReading | null,
  stabilizedPitch: StabilizedPitchReading | null,
  targets: readonly TuningTarget[],
): TuningTarget | null {
  // 自由模式没有弦归属
  if (selection.mode === "chromatic") {
    return null;
  }

  const manuallySelectedTarget = getSelectedTarget(selection, targets);

  if (manuallySelectedTarget) {
    return manuallySelectedTarget;
  }

  if (stabilizedPitch?.target) {
    return stabilizedPitch.target;
  }

  if (detectedPitch) {
    return findClosestTuningTarget(detectedPitch.frequencyHz, targets);
  }

  return null;
}

export function resolveDeviation(
  target: TuningTarget | null,
  stabilizedPitch: StabilizedPitchReading | null,
  detectedPitch: PitchReading | null,
): TunerDeviation | null {
  const activeReading = stabilizedPitch ?? detectedPitch;

  if (!target || !activeReading) {
    return null;
  }

  return createDeviationFromCents(getCentsOffset(activeReading.frequencyHz, target.frequencyHz));
}
