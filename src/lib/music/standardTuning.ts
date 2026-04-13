import type { TuningTarget } from "../../types/tuner";

export const STANDARD_GUITAR_TUNING: readonly TuningTarget[] = [
  { id: "string-6", label: "6", note: "E", octave: 2, frequencyHz: 82.41 },
  { id: "string-5", label: "5", note: "A", octave: 2, frequencyHz: 110.0 },
  { id: "string-4", label: "4", note: "D", octave: 3, frequencyHz: 146.83 },
  { id: "string-3", label: "3", note: "G", octave: 3, frequencyHz: 196.0 },
  { id: "string-2", label: "2", note: "B", octave: 3, frequencyHz: 246.94 },
  { id: "string-1", label: "1", note: "E", octave: 4, frequencyHz: 329.63 },
] as const;

export const DEFAULT_TUNING_TARGET = STANDARD_GUITAR_TUNING[0];

export const STANDARD_TUNING_BY_ID: Readonly<Record<TuningTarget["id"], TuningTarget>> = {
  "string-6": STANDARD_GUITAR_TUNING[0],
  "string-5": STANDARD_GUITAR_TUNING[1],
  "string-4": STANDARD_GUITAR_TUNING[2],
  "string-3": STANDARD_GUITAR_TUNING[3],
  "string-2": STANDARD_GUITAR_TUNING[4],
  "string-1": STANDARD_GUITAR_TUNING[5],
};

export function getStandardTuningTarget(targetId: TuningTarget["id"]): TuningTarget {
  return STANDARD_TUNING_BY_ID[targetId];
}
