import { useMemo, useState } from "react";
import {
  CUSTOM_TUNING_MAX_STRINGS,
  CUSTOM_TUNING_MIN_STRINGS,
  STANDARD_E_TUNING,
  findDuplicateFrequencyNumbers,
} from "../../../lib/music";
import type { NoteName, TuningStringSpec } from "../../../types/tuner";
import { NoteDrum } from "./NoteDrum";
import { noteNameToMidi } from "../../../lib/music/noteMapping";

type CustomTuningEditorProps = {
  onCancel: () => void;
  /** 保存回调(hook 层负责建 id、入库、激活) */
  onSave: (strings: readonly TuningStringSpec[], name: string) => void;
};

/**
 * 自定义调弦编辑器:每根弦一个密码锁式音高转轮,
 * 支持增减最低弦(4–8 弦),两弦同频高亮警示(unison 合法但要点破)。
 */
export function CustomTuningEditor({ onCancel, onSave }: CustomTuningEditorProps) {
  const [name, setName] = useState("");
  const [strings, setStrings] = useState<readonly TuningStringSpec[]>(() =>
    [...STANDARD_E_TUNING.strings].sort((a, b) => b.number - a.number),
  );

  // 渲染顺序:6 弦在左(与轨道一致)
  const rows = useMemo(
    () => [...strings].sort((a, b) => b.number - a.number),
    [strings],
  );
  const duplicateNumbers = useMemo(
    () => findDuplicateFrequencyNumbers(strings),
    [strings],
  );

  const updateString = (number: number, midi: number) => {
    const semitoneIndex = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    setStrings((previous) =>
      previous.map((spec) =>
        spec.number === number
          ? { ...spec, note: NOTE_ORDER[semitoneIndex], octave }
          : spec,
      ),
    );
  };

  const addLowestString = () => {
    setStrings((previous) => {
      if (previous.length >= CUSTOM_TUNING_MAX_STRINGS) {
        return previous;
      }
      const lowest = previous.reduce((min, spec) => (spec.number < min.number ? spec : min));
      // 新低音弦:同音名低一个八度,下限 C1
      const octave = Math.max(1, lowest.octave - 1);
      return [...previous, { number: lowest.number - 1, note: lowest.note, octave }];
    });
  };

  const removeLowestString = () => {
    setStrings((previous) => {
      if (previous.length <= CUSTOM_TUNING_MIN_STRINGS) {
        return previous;
      }
      const lowestNumber = previous.reduce((min, spec) => Math.min(min, spec.number), Number.POSITIVE_INFINITY);
      return previous.filter((spec) => spec.number !== lowestNumber);
    });
  };

  return (
    <div className="editor-overlay" onClick={onCancel}>
      <div
        className="editor-card"
        role="dialog"
        aria-modal="true"
        aria-label="自定义调弦"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <header className="editor-head">
          <h2 className="editor-title">自定义调弦</h2>
          <input
            className="editor-name"
            type="text"
            value={name}
            maxLength={16}
            placeholder="调弦名称(可选)"
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </header>

        <div className="editor-rows">
          {rows.map((spec) => {
            const midi = noteNameToMidi(spec.note, spec.octave);
            const isDuplicate = duplicateNumbers.has(spec.number);
            return (
              <div className="editor-row" key={spec.number} data-dup={isDuplicate}>
                <span className="editor-row-label">{spec.number} 弦</span>
                <NoteDrum
                  label={`${spec.number} 弦音高`}
                  value={midi}
                  onChange={(next) => {
                    updateString(spec.number, next);
                  }}
                />
                {isDuplicate ? (
                  <span className="editor-row-flag">同频</span>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="editor-strings-actions">
          <button
            type="button"
            className="editor-strings-button"
            onClick={addLowestString}
            disabled={strings.length >= CUSTOM_TUNING_MAX_STRINGS}
          >
            ＋ 添加低音弦
          </button>
          <button
            type="button"
            className="editor-strings-button"
            onClick={removeLowestString}
            disabled={strings.length <= CUSTOM_TUNING_MIN_STRINGS}
          >
            － 移除最低弦
          </button>
        </div>

        <footer className="editor-actions">
          <button type="button" className="editor-cancel" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="editor-save"
            onClick={() => {
              onSave(strings, name);
            }}
          >
            保存并使用
          </button>
        </footer>
      </div>
    </div>
  );
}

const NOTE_ORDER: readonly NoteName[] = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];
