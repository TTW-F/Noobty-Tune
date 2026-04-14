import test from "node:test";
import assert from "node:assert/strict";
import {
  createDeviationFromCents,
  findClosestTuningTarget,
  frequencyToMidi,
  getClosestNoteMatch,
  getCentsOffset,
  midiToFrequency,
} from "./noteMapping";

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

test("findClosestTuningTarget prefers the nearest standard guitar string", () => {
  const nearA = findClosestTuningTarget(111.2);
  const nearHighE = findClosestTuningTarget(328.5);

  assert.ok(nearA);
  assert.equal(nearA!.id, "string-5");
  assert.ok(nearHighE);
  assert.equal(nearHighE!.id, "string-1");
});
