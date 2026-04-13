export type TuningStringId =
  | "string-6"
  | "string-5"
  | "string-4"
  | "string-3"
  | "string-2"
  | "string-1";

export type NoteName = "C" | "C#" | "D" | "D#" | "E" | "F" | "F#" | "G" | "G#" | "A" | "A#" | "B";

export type DetectionSource = "microphone" | "test-tone" | "unknown";

export type AudioEngineStatus =
  | "idle"
  | "requesting-permission"
  | "permission-denied"
  | "initializing-audio"
  | "ready"
  | "listening"
  | "suspended"
  | "error";

export type TunerUiStatus =
  | "idle"
  | "initializing"
  | "requesting-permission"
  | "permission-denied"
  | "listening"
  | "no-signal"
  | "detecting"
  | "unstable"
  | "in-tune"
  | "error";

export interface PitchReading {
  readonly frequencyHz: number;
  readonly clarity: number;
  readonly timestampMs: number;
  readonly source: DetectionSource;
}

export interface StabilizedPitchReading extends PitchReading {
  readonly stable: boolean;
  readonly sampleCount: number;
}

export interface TuningTarget {
  readonly id: TuningStringId;
  readonly label: string;
  readonly note: NoteName;
  readonly octave: number;
  readonly frequencyHz: number;
}

export interface TunerDeviation {
  readonly cents: number;
  readonly direction: "flat" | "in-tune" | "sharp";
}

export interface TunerSelection {
  readonly mode: "auto" | "manual";
  readonly targetId: TuningStringId | null;
}

export interface TunerEngineError {
  readonly code: string;
  readonly message: string;
  readonly recoverable: boolean;
}

export interface TunerState {
  readonly audioStatus: AudioEngineStatus;
  readonly uiStatus: TunerUiStatus;
  readonly selection: TunerSelection;
  readonly activeTarget: TuningTarget | null;
  readonly detectedPitch: PitchReading | null;
  readonly stabilizedPitch: StabilizedPitchReading | null;
  readonly deviation: TunerDeviation | null;
  readonly lastError: TunerEngineError | null;
}

export interface PitchDetector {
  detect(input: Float32Array, sampleRate: number, timestampMs?: number): PitchReading | null;
  reset?(): void;
}

export interface PitchStabilizer {
  push(reading: PitchReading | null): StabilizedPitchReading | null;
  reset(): void;
}
