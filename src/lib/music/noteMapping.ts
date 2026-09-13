import type { NoteMatch, NoteName, TunerDeviation, TuningTarget } from "../../types/tuner";

const NOTE_NAMES: readonly NoteName[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** 半音阶音名序列(音名尺等 UI 直接消费) */
export const CHROMATIC_NOTE_NAMES = NOTE_NAMES;
const A4_FREQUENCY = 440;
const A4_MIDI = 69;

export function frequencyToMidi(frequencyHz: number): number {
  return 12 * Math.log2(frequencyHz / A4_FREQUENCY) + A4_MIDI;
}

export function midiToFrequency(midi: number, referenceA4Hz: number = A4_FREQUENCY): number {
  return referenceA4Hz * 2 ** ((midi - A4_MIDI) / 12);
}

export function noteNameToMidi(note: NoteName, octave: number): number {
  const semitoneIndex = NOTE_NAMES.indexOf(note);
  if (semitoneIndex < 0) {
    throw new Error(`Unknown note name: ${note}`);
  }

  return semitoneIndex + (octave + 1) * 12;
}

/**
 * 解析 "G#2" / "F#" 这类音名代码为结构化的音名 + 可空八度。
 * 解释器的 detectedNote 带八度;reading 的 noteName 只有音名。
 */
export function parseNoteCode(
  code: string,
): { note: NoteName; octave: number | null; sharp: boolean } | null {
  if (!code) {
    return null;
  }

  const match = /^([A-G]#?)(-?\d+)$/.exec(code);
  if (match && NOTE_NAMES.includes(match[1] as NoteName)) {
    return { note: match[1] as NoteName, octave: Number(match[2]), sharp: match[1].includes("#") };
  }

  if (NOTE_NAMES.includes(code as NoteName)) {
    return { note: code as NoteName, octave: null, sharp: code.includes("#") };
  }

  return null;
}

/**
 * 音名尺选定目标音时,给音名配一个离当前检测频率最近的八度;
 * 没有检测频率时回落到 3 号八度(中音区)。
 */
export function pickOctaveForNote(note: NoteName, frequencyHz: number | null): number {
  if (!Number.isFinite(frequencyHz) || frequencyHz === null || frequencyHz <= 0) {
    return 3;
  }

  let bestOctave = 3;
  let bestDistanceCents = Number.POSITIVE_INFINITY;
  for (let octave = 1; octave <= 7; octave += 1) {
    const distanceCents = Math.abs(
      getCentsOffset(frequencyHz, midiToFrequency(noteNameToMidi(note, octave))),
    );
    if (distanceCents < bestDistanceCents) {
      bestDistanceCents = distanceCents;
      bestOctave = octave;
    }
  }

  return bestOctave;
}

export function getClosestNoteMatch(frequencyHz: number): NoteMatch | null {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    return null;
  }

  const midi = Math.round(frequencyToMidi(frequencyHz));
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const noteFrequencyHz = midiToFrequency(midi);
  const cents = 1200 * Math.log2(frequencyHz / noteFrequencyHz);

  return {
    note: NOTE_NAMES[noteIndex],
    octave,
    midi,
    frequencyHz: noteFrequencyHz,
    cents,
  };
}

export function getCentsOffset(frequencyHz: number, targetFrequencyHz: number): number {
  if (
    !Number.isFinite(frequencyHz) ||
    !Number.isFinite(targetFrequencyHz) ||
    frequencyHz <= 0 ||
    targetFrequencyHz <= 0
  ) {
    return 0;
  }

  return 1200 * Math.log2(frequencyHz / targetFrequencyHz);
}

export function createDeviationFromCents(cents: number, inTuneTolerance = 5): TunerDeviation {
  if (Math.abs(cents) <= inTuneTolerance) {
    return {
      cents,
      direction: "in-tune",
    };
  }

  return {
    cents,
    direction: cents < 0 ? "flat" : "sharp",
  };
}

export function findClosestTuningTarget(
  frequencyHz: number,
  tuning: readonly TuningTarget[],
): TuningTarget | null {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    return null;
  }

  let closestTarget: TuningTarget | null = null;
  let smallestAbsoluteCents = Number.POSITIVE_INFINITY;

  for (const target of tuning) {
    const cents = Math.abs(getCentsOffset(frequencyHz, target.frequencyHz));

    if (cents < smallestAbsoluteCents) {
      smallestAbsoluteCents = cents;
      closestTarget = target;
    }
  }

  return closestTarget;
}
