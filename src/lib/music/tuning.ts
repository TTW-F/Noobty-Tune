import type { Tuning, TuningId, TuningStringId, TuningStringSpec, TuningTarget } from "../../types/tuner";
import { CHROMATIC_NOTE_NAMES, midiToFrequency, noteNameToMidi } from "./noteMapping";

const DEFAULT_REFERENCE_A4_HZ = 440;

export const STANDARD_E_TUNING: Tuning = {
  id: "builtin:standard-e",
  name: "标准 E",
  kind: "builtin",
  strings: [
    { number: 6, note: "E", octave: 2 },
    { number: 5, note: "A", octave: 2 },
    { number: 4, note: "D", octave: 3 },
    { number: 3, note: "G", octave: 3 },
    { number: 2, note: "B", octave: 3 },
    { number: 1, note: "E", octave: 4 },
  ],
};

const DROP_D_TUNING: Tuning = {
  id: "builtin:drop-d",
  name: "Drop D",
  kind: "builtin",
  strings: [
    { number: 6, note: "D", octave: 2 },
    { number: 5, note: "A", octave: 2 },
    { number: 4, note: "D", octave: 3 },
    { number: 3, note: "G", octave: 3 },
    { number: 2, note: "B", octave: 3 },
    { number: 1, note: "E", octave: 4 },
  ],
};

const EB_STANDARD_TUNING: Tuning = {
  id: "builtin:eb-standard",
  name: "Eb 半音降",
  kind: "builtin",
  strings: [
    { number: 6, note: "D#", octave: 2 },
    { number: 5, note: "G#", octave: 2 },
    { number: 4, note: "C#", octave: 3 },
    { number: 3, note: "F#", octave: 3 },
    { number: 2, note: "A#", octave: 3 },
    { number: 1, note: "D#", octave: 4 },
  ],
};

const D_STANDARD_TUNING: Tuning = {
  id: "builtin:d-standard",
  name: "D 标准",
  kind: "builtin",
  strings: [
    { number: 6, note: "D", octave: 2 },
    { number: 5, note: "G", octave: 2 },
    { number: 4, note: "C", octave: 3 },
    { number: 3, note: "F", octave: 3 },
    { number: 2, note: "A", octave: 3 },
    { number: 1, note: "D", octave: 4 },
  ],
};

const OPEN_G_TUNING: Tuning = {
  id: "builtin:open-g",
  name: "Open G",
  kind: "builtin",
  strings: [
    { number: 6, note: "D", octave: 2 },
    { number: 5, note: "G", octave: 2 },
    { number: 4, note: "D", octave: 3 },
    { number: 3, note: "G", octave: 3 },
    { number: 2, note: "B", octave: 3 },
    { number: 1, note: "D", octave: 4 },
  ],
};

const OPEN_D_TUNING: Tuning = {
  id: "builtin:open-d",
  name: "Open D",
  kind: "builtin",
  strings: [
    { number: 6, note: "D", octave: 2 },
    { number: 5, note: "A", octave: 2 },
    { number: 4, note: "D", octave: 3 },
    { number: 3, note: "F#", octave: 3 },
    { number: 2, note: "A", octave: 3 },
    { number: 1, note: "D", octave: 4 },
  ],
};

const DADGAD_TUNING: Tuning = {
  id: "builtin:dadgad",
  name: "DADGAD",
  kind: "builtin",
  strings: [
    { number: 6, note: "D", octave: 2 },
    { number: 5, note: "A", octave: 2 },
    { number: 4, note: "D", octave: 3 },
    { number: 3, note: "G", octave: 3 },
    { number: 2, note: "A", octave: 3 },
    { number: 1, note: "D", octave: 4 },
  ],
};

const B_STANDARD_7_TUNING: Tuning = {
  id: "builtin:b-standard-7",
  name: "B 标准 · 7弦",
  kind: "builtin",
  strings: [
    { number: 7, note: "B", octave: 1 },
    { number: 6, note: "E", octave: 2 },
    { number: 5, note: "A", octave: 2 },
    { number: 4, note: "D", octave: 3 },
    { number: 3, note: "G", octave: 3 },
    { number: 2, note: "B", octave: 3 },
    { number: 1, note: "E", octave: 4 },
  ],
};

export const BUILTIN_TUNINGS: readonly Tuning[] = [
  STANDARD_E_TUNING,
  DROP_D_TUNING,
  EB_STANDARD_TUNING,
  D_STANDARD_TUNING,
  OPEN_G_TUNING,
  OPEN_D_TUNING,
  DADGAD_TUNING,
  B_STANDARD_7_TUNING,
];

/** 标准 E 调弦解析后的规范目标集——测试与夹具统一从这里取,避免各自 resolve。 */
export const STANDARD_TUNING_TARGETS: readonly TuningTarget[] =
  resolveTargets(STANDARD_E_TUNING);

const CUSTOM_TUNING_ID_PREFIX = "custom:";

/** 自定义调弦的弦数边界(4 = 贝斯/尤克里里量级,8 = 8 弦吉他) */
export const CUSTOM_TUNING_MIN_STRINGS = 4;
export const CUSTOM_TUNING_MAX_STRINGS = 8;

let customTuningSeq = 0;

/**
 * 由编辑器产出的弦规格创建自定义调弦。
 * 校验失败抛错——编辑器 UI 应在保存前先行校验,这里是最后一道闸。
 */
export function createCustomTuning(name: string, strings: readonly TuningStringSpec[]): Tuning {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Custom tuning needs a name");
  }

  if (
    strings.length < CUSTOM_TUNING_MIN_STRINGS ||
    strings.length > CUSTOM_TUNING_MAX_STRINGS
  ) {
    throw new Error(
      `Custom tuning needs ${CUSTOM_TUNING_MIN_STRINGS}-${CUSTOM_TUNING_MAX_STRINGS} strings, got ${strings.length}`,
    );
  }

  const seenNumbers = new Set<number>();
  for (const spec of strings) {
    if (!Number.isInteger(spec.number) || spec.number < 1 || spec.number > 12) {
      throw new Error(`Invalid string number: ${spec.number}`);
    }
    if (seenNumbers.has(spec.number)) {
      throw new Error(`Duplicate string number: ${spec.number}`);
    }
    seenNumbers.add(spec.number);

    if (!CHROMATIC_NOTE_NAMES.includes(spec.note)) {
      throw new Error(`Invalid note name: ${spec.note}`);
    }
    if (!Number.isInteger(spec.octave) || spec.octave < 1 || spec.octave > 7) {
      throw new Error(`Invalid octave for string ${spec.number}: ${spec.octave}`);
    }
  }

  customTuningSeq += 1;
  return {
    id: `${CUSTOM_TUNING_ID_PREFIX}${Date.now().toString(36)}-${customTuningSeq}`,
    name: trimmedName,
    kind: "custom",
    strings: [...strings].sort((a, b) => b.number - a.number),
  };
}

export function isCustomTuningId(id: TuningId): boolean {
  return id.startsWith(CUSTOM_TUNING_ID_PREFIX);
}

/**
 * 找出与其他弦频率相同(±0.01 Hz)的弦号——unison 是合法调弦,
 * 调用方(编辑器)负责高亮警示而非阻止。
 */
export function findDuplicateFrequencyNumbers(
  strings: readonly TuningStringSpec[],
  referenceA4Hz: number = 440,
): Set<number> {
  const frequencyByNumber = new Map<number, number>();
  for (const spec of strings) {
    frequencyByNumber.set(
      spec.number,
      midiToFrequency(noteNameToMidi(spec.note, spec.octave), referenceA4Hz),
    );
  }

  const duplicates = new Set<number>();
  const entries = [...frequencyByNumber.entries()];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      if (Math.abs(entries[i][1] - entries[j][1]) < 0.01) {
        duplicates.add(entries[i][0]);
        duplicates.add(entries[j][0]);
      }
    }
  }

  return duplicates;
}

export const DEFAULT_TUNING_ID: TuningId = STANDARD_E_TUNING.id;

export function getTuning(id: TuningId): Tuning | null {
  return BUILTIN_TUNINGS.find((tuning) => tuning.id === id) ?? null;
}

/**
 * 调弦的唯一推导入口:把音名规格解析成逐帧可用的目标频率。
 * 输出按弦号降序(6 → 1,低音弦在前),与轨道渲染顺序一致。
 * A4 参考音是参数而非接缝——目前只有十二平均律一种实现。
 */
export function resolveTargets(
  tuning: Tuning,
  referenceA4Hz: number = DEFAULT_REFERENCE_A4_HZ,
): readonly TuningTarget[] {
  return [...tuning.strings]
    .sort((a, b) => b.number - a.number)
    .map((spec) => ({
      id: `string-${spec.number}` as TuningStringId,
      label: String(spec.number),
      note: spec.note,
      octave: spec.octave,
      frequencyHz: midiToFrequency(noteNameToMidi(spec.note, spec.octave), referenceA4Hz),
    }));
}
