import type { NoteMatch, NoteName, TunerDeviation, TuningTarget } from "../../types/tuner";
import { STANDARD_GUITAR_TUNING } from "./standardTuning";

const NOTE_NAMES: readonly NoteName[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const A4_FREQUENCY = 440;
const A4_MIDI = 69;

export function frequencyToMidi(frequencyHz: number): number {
  return 12 * Math.log2(frequencyHz / A4_FREQUENCY) + A4_MIDI;
}

export function midiToFrequency(midi: number): number {
  return A4_FREQUENCY * 2 ** ((midi - A4_MIDI) / 12);
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
  tuning: readonly TuningTarget[] = STANDARD_GUITAR_TUNING,
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
