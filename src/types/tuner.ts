/**
 * 弦 ID 是位置编号(1 = 最细弦),在任一调弦内唯一。
 * 模板字面量类型让 7 弦、贝斯等不需要改类型。
 */
export type TuningStringId = `string-${number}`;

export type TuningId = string;

/** 弦规格:存音名,不存频率——频率由 resolveTargets 按 A4 参考音推导。 */
export interface TuningStringSpec {
  readonly number: number;
  readonly note: NoteName;
  readonly octave: number;
}

export interface Tuning {
  readonly id: TuningId;
  readonly name: string;
  readonly kind: "builtin" | "custom";
  readonly strings: readonly TuningStringSpec[];
}

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
  | "signal-weak"
  | "no-signal"
  | "detecting"
  | "unstable"
  | "in-tune"
  | "error";

export interface AudioFrame {
  readonly samples: Float32Array;
  readonly sampleRate: number;
  readonly timestampMs: number;
  readonly rms: number;
  readonly peak: number;
}

export interface PitchReading {
  readonly frequencyHz: number;
  readonly clarity: number;
  readonly timestampMs: number;
  readonly source: DetectionSource;
  readonly rms?: number;
  readonly noteName?: NoteName;
  readonly octave?: number;
  readonly cents?: number;
}

export interface StabilizedPitchReading extends PitchReading {
  readonly stable: boolean;
  readonly sampleCount: number;
  readonly target: TuningTarget | null;
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

export interface NoteMatch {
  readonly note: NoteName;
  readonly octave: number;
  readonly midi: number;
  readonly frequencyHz: number;
  readonly cents: number;
}

export interface TunerSelection {
  /** 当前激活的调弦;目标频率由它推导 */
  readonly tuningId: TuningId;
  /**
   * auto: 自动归属最近的弦;manual: 锁定一根弦;chromatic: 自由模式,
   * 不归属任何弦,按最近的半音名评判(chromatic 下 targetId 被忽略)。
   */
  readonly mode: "auto" | "manual" | "chromatic";
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
  push(reading: PitchReading | null, targetHint?: TuningTarget | null): StabilizedPitchReading | null;
  reset(): void;
}
