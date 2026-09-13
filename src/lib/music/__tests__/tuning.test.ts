import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILTIN_TUNINGS,
  DEFAULT_TUNING_ID,
  STANDARD_E_TUNING,
  createCustomTuning,
  findDuplicateFrequencyNumbers,
  getTuning,
  resolveTargets,
} from "../tuning";
import { midiToFrequency, noteNameToMidi } from "../noteMapping";
import type { Tuning } from "../../../types/tuner";

test("resolveTargets derives standard E frequencies in rail order (6 → 1)", () => {
  const targets = resolveTargets(STANDARD_E_TUNING);

  assert.equal(targets.length, 6);
  assert.deepEqual(
    targets.map((target) => target.id),
    ["string-6", "string-5", "string-4", "string-3", "string-2", "string-1"],
  );
  assert.ok(Math.abs(targets[0].frequencyHz - 82.41) < 0.01, `E2 = ${targets[0].frequencyHz}`);
  assert.ok(Math.abs(targets[1].frequencyHz - 110) < 0.01);
  assert.ok(Math.abs(targets[5].frequencyHz - 329.63) < 0.01);
  assert.equal(targets[0].label, "6");
});

test("resolveTargets shifts every target when the A4 reference changes", () => {
  const at440 = resolveTargets(STANDARD_E_TUNING);
  const at415 = resolveTargets(STANDARD_E_TUNING, 415);

  const shiftCents = 1200 * Math.log2(at415[0].frequencyHz / at440[0].frequencyHz);
  const expectedCents = 1200 * Math.log2(415 / 440);

  assert.ok(Math.abs(shiftCents - expectedCents) < 0.001);
});

test("every builtin target matches its note spec derived at A4=440", () => {
  for (const tuning of BUILTIN_TUNINGS) {
    for (const target of resolveTargets(tuning)) {
      const expected = midiToFrequency(noteNameToMidi(target.note, target.octave));
      assert.ok(
        Math.abs(target.frequencyHz - expected) < 0.001,
        `${tuning.id} ${target.id}: ${target.frequencyHz} vs ${expected}`,
      );
    }
  }
});

test("string ids are unique within a tuning", () => {
  for (const tuning of BUILTIN_TUNINGS) {
    const ids = resolveTargets(tuning).map((target) => target.id);
    assert.equal(new Set(ids).size, ids.length, tuning.id);
  }
});

test("resolveTargets supports arbitrary string counts (7-string readiness)", () => {
  const sevenString: Tuning = {
    id: "custom:test-7",
    name: "七弦测试",
    kind: "custom",
    strings: [
      { number: 7, note: "B", octave: 1 },
      ...STANDARD_E_TUNING.strings,
    ],
  };

  const targets = resolveTargets(sevenString);

  assert.equal(targets.length, 7);
  assert.equal(targets[0].id, "string-7");
  assert.ok(Math.abs(targets[0].frequencyHz - 61.74) < 0.01, `B1 = ${targets[0].frequencyHz}`);
});

test("builtin presets cover common alternate tunings and 7-string", () => {
  const ids = BUILTIN_TUNINGS.map((tuning) => tuning.id);

  for (const expected of [
    "builtin:standard-e",
    "builtin:drop-d",
    "builtin:eb-standard",
    "builtin:d-standard",
    "builtin:open-g",
    "builtin:open-d",
    "builtin:dadgad",
    "builtin:b-standard-7",
  ]) {
    assert.ok(ids.includes(expected), `missing preset ${expected}`);
  }
});

test("drop D only changes string 6 relative to standard E", () => {
  const standard = resolveTargets(getTuning("builtin:standard-e")!);
  const dropD = resolveTargets(getTuning("builtin:drop-d")!);

  assert.equal(dropD.length, standard.length);
  for (let index = 1; index < standard.length; index += 1) {
    assert.equal(dropD[index].frequencyHz, standard[index].frequencyHz);
  }
  assert.ok(Math.abs(dropD[0].frequencyHz - 73.42) < 0.01, `D2 = ${dropD[0].frequencyHz}`);
});

test("open G resolves to D2 G2 D3 G3 B3 D4", () => {
  const targets = resolveTargets(getTuning("builtin:open-g")!);

  assert.deepEqual(
    targets.map((target) => `${target.note}${target.octave}`),
    ["D2", "G2", "D3", "G3", "B3", "D4"],
  );
  assert.ok(Math.abs(targets[0].frequencyHz - 73.42) < 0.01);
});

test("7-string B standard resolves seven targets down to B1", () => {
  const targets = resolveTargets(getTuning("builtin:b-standard-7")!);

  assert.equal(targets.length, 7);
  assert.equal(targets[0].id, "string-7");
  assert.ok(Math.abs(targets[0].frequencyHz - 61.74) < 0.01, `B1 = ${targets[0].frequencyHz}`);
});

test("createCustomTuning produces a valid custom tuning", () => {
  const tuning = createCustomTuning("我的调弦", [
    { number: 6, note: "C", octave: 2 },
    { number: 5, note: "G", octave: 2 },
    { number: 4, note: "D", octave: 3 },
    { number: 3, note: "G", octave: 3 },
    { number: 2, note: "C", octave: 4 },
  ]);

  assert.ok(tuning.id.startsWith("custom:"));
  assert.equal(tuning.kind, "custom");
  assert.equal(tuning.name, "我的调弦");
  // 输出按弦号降序
  assert.deepEqual(
    tuning.strings.map((spec) => spec.number),
    [6, 5, 4, 3, 2],
  );
  // getTuning 不含自定义(它们由 hook 层注册表解析)
  assert.equal(getTuning(tuning.id), null);
  const targets = resolveTargets(tuning);
  assert.equal(targets.length, 5);
  assert.ok(Math.abs(targets[0].frequencyHz - midiToFrequency(noteNameToMidi("C", 2))) < 0.001);
});

test("createCustomTuning rejects invalid input", () => {
  const valid = [
    { number: 6, note: "E", octave: 2 },
    { number: 5, note: "A", octave: 2 },
    { number: 4, note: "D", octave: 3 },
    { number: 3, note: "G", octave: 3 },
  ];

  assert.throws(() => createCustomTuning("  ", valid), /name/);
  assert.throws(() => createCustomTuning("x", valid.slice(0, 3)), /strings/);
  assert.throws(
    () =>
      createCustomTuning("x", [
        ...valid,
        { number: 6, note: "B", octave: 2 },
      ]),
    /Duplicate string number/,
  );
  assert.throws(
    () => createCustomTuning("x", [...valid, { number: 2, note: "H" as never, octave: 3 }]),
    /Invalid note name/,
  );
  assert.throws(
    () => createCustomTuning("x", [...valid, { number: 2, note: "B", octave: 9 }]),
    /Invalid octave/,
  );
});

test("findDuplicateFrequencyNumbers flags unison strings only", () => {
  // 标准 E 无同频
  assert.equal(findDuplicateFrequencyNumbers(STANDARD_E_TUNING.strings).size, 0);

  // 6/5 弦都设为 A2 → 两根都被标记
  const dups = findDuplicateFrequencyNumbers([
    { number: 6, note: "A", octave: 2 },
    { number: 5, note: "A", octave: 2 },
    { number: 4, note: "D", octave: 3 },
    { number: 3, note: "G", octave: 3 },
  ]);
  assert.deepEqual([...dups].sort(), [5, 6]);
});

test("getTuning resolves builtins by id and returns null for unknown or custom ids", () => {
  assert.equal(getTuning(DEFAULT_TUNING_ID)?.name, STANDARD_E_TUNING.name);
  assert.equal(getTuning("builtin:nope"), null);
  assert.equal(getTuning("custom:someone-elses"), null);
});
