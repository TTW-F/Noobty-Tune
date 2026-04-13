import { getStandardTuningTarget } from "../../../lib/music/standardTuning";
import type { PitchReading, StabilizedPitchReading, TunerDeviation, TunerEngineError, TunerSelection, TunerState, TuningTarget } from "../../../types/tuner";

export const DEFAULT_TUNER_SELECTION: TunerSelection = {
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

export function getSelectedTarget(selection: TunerSelection): TuningTarget | null {
  if (selection.mode === "manual" && selection.targetId) {
    return getStandardTuningTarget(selection.targetId);
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
