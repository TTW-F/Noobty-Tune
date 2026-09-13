import test from "node:test";
import assert from "node:assert/strict";
import {
  CHROMATIC_NOTE_NAMES,
  createDeviationFromCents,
  findClosestTuningTarget,
  frequencyToMidi,
  getClosestNoteMatch,
  getCentsOffset,
  midiToFrequency,
  pickOctaveForNote,
} from "./noteMapping";
import { STANDARD_TUNING_TARGETS } from "./tuning";

const TARGETS = STANDARD_TUNING_TARGETS;

test("chromatic note names cover twelve semitones starting at C", () => {
  assert.equal(CHROMATIC_NOTE_NAMES.length, 12);
  assert.equal(CHROMATIC_NOTE_NAMES[0], "C");
  assert.equal(CHROMATIC_NOTE_NAMES[9], "A");
});

test("pickOctaveForNote chooses the octave nearest the detected frequency", () => {
  assert.equal(pickOctaveForNote("E", 82.41), 2);
  assert.equal(pickOctaveForNote("E", 329.63), 4);
  assert.equal(pickOctaveForNote("A", 110), 2);
  assert.equal(pickOctaveForNote("G#", 106), 2);
});

test("pickOctaveForNote falls back to octave 3 without a frequency", () => {
  assert.equal(pickOctaveForNote("E", null), 3);
  assert.equal(pickOctaveForNote("A", 0), 3);
});

test("frequencyToMidi and midiToFrequency round-trip concert A", () => {
  assert.equal(frequencyToMidi(440), 69);
  assert.equal(midiToFrequency(69), 440);
});

test("getClosestNoteMatch resolves standard guitar low E", () => {
  const match = getClosestNoteMatch(82.41);

  assert.ok(match);
  assert.equal(match!.note, "E");
  assert.equal(match!.octave, 2);
  assert.ok(Math.abs(match!.cents) < 1);
});

test("getCentsOffset returns positive and negative values with expected direction", () => {
  const sharp = getCentsOffset(110.5, 110);
  const flat = getCentsOffset(109.5, 110);

  assert.ok(sharp > 0);
  assert.ok(flat < 0);
});

test("createDeviationFromCents uses in-tune tolerance before flat or sharp", () => {
  assert.equal(createDeviationFromCents(4.9).direction, "in-tune");
  assert.equal(createDeviationFromCents(-6).direction, "flat");
  assert.equal(createDeviationFromCents(6).direction, "sharp");
});

test("findClosestTuningTarget prefers the nearest string of the given tuning", () => {
  const nearA = findClosestTuningTarget(111.2, TARGETS);
  const nearHighE = findClosestTuningTarget(328.5, TARGETS);

  assert.ok(nearA);
  assert.equal(nearA!.id, "string-5");
  assert.ok(nearHighE);
  assert.equal(nearHighE!.id, "string-1");
});
