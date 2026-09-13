import { useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CHROMATIC_NOTE_NAMES } from "../../../lib/music/noteMapping";
import type { NoteName } from "../../../types/tuner";

const ITEM_HEIGHT = 34;
const VISIBLE_ITEMS = 5;
/** 选中项居中所需的偏移:可见区上下各留 (VISIBLE-1)/2 项 */
const CENTER_OFFSET = ITEM_HEIGHT * ((VISIBLE_ITEMS - 1) / 2);

export const DRUM_MIN_MIDI = 24; // C1
export const DRUM_MAX_MIDI = 95; // B6

interface DrumOption {
  readonly midi: number;
  readonly note: NoteName;
  readonly octave: number;
  readonly label: string;
}

const DRUM_OPTIONS: readonly DrumOption[] = (() => {
  const options: DrumOption[] = [];
  for (let midi = DRUM_MIN_MIDI; midi <= DRUM_MAX_MIDI; midi += 1) {
    const note = CHROMATIC_NOTE_NAMES[((midi % 12) + 12) % 12];
    const octave = Math.floor(midi / 12) - 1;
    options.push({ midi, note, octave, label: `${note}${octave}` });
  }
  return options;
})();

type NoteDrumProps = {
  /** 无障碍名称,如 "6 弦音高" */
  label: string;
  /** 当前选中的 MIDI 音高 */
  value: number;
  onChange: (midi: number) => void;
};

/**
 * 密码锁式音高转轮:滚轮 / ↑↓ 键 / 点击候选三种方式选音,
 * 选中项弹簧动画居中并高亮。5 项可视窗口,72 个半音(C1–B6)。
 */
export function NoteDrum({ label, value, onChange }: NoteDrumProps) {
  const reducedMotion = useReducedMotion();
  const listRef = useRef<HTMLDivElement>(null);

  const selectedIndex = useMemo(() => {
    const clamped = Math.max(DRUM_MIN_MIDI, Math.min(DRUM_MAX_MIDI, value));
    return clamped - DRUM_MIN_MIDI;
  }, [value]);

  const step = (delta: number) => {
    const nextIndex = Math.max(0, Math.min(DRUM_OPTIONS.length - 1, selectedIndex + delta));
    if (nextIndex !== selectedIndex) {
      onChange(DRUM_OPTIONS[nextIndex].midi);
    }
  };

  // React 的 onWheel 是被动监听,滚轮选音必须阻止页面滚动 → 手动挂非被动监听
  useEffect(() => {
    const element = listRef.current;
    if (!element) {
      return;
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      step(Math.sign(event.deltaY));
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel);
    };
  });

  return (
    <div
      className="note-drum"
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onKeyDown={(event) => {
        // 语义按音高走:↑ = 升高(紧弦),↓ = 降低,与指针表的偏高/偏低一致
        if (event.key === "ArrowUp") {
          event.preventDefault();
          step(1);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          step(-1);
        } else if (event.key === "PageUp") {
          event.preventDefault();
          step(12);
        } else if (event.key === "PageDown") {
          event.preventDefault();
          step(-12);
        }
      }}
    >
      <div className="note-drum-window" ref={listRef} style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}>
        <motion.div
          className="note-drum-strip"
          initial={false}
          animate={{ y: CENTER_OFFSET - selectedIndex * ITEM_HEIGHT }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 380, damping: 34, mass: 0.6 }
          }
        >
          {DRUM_OPTIONS.map((option) => {
            const selected = option.midi === value;
            return (
              <button
                key={option.midi}
                type="button"
                role="option"
                aria-selected={selected}
                className="note-drum-item"
                data-selected={selected}
                style={{ height: ITEM_HEIGHT }}
                onClick={() => {
                  onChange(option.midi);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </motion.div>
      </div>
      <div className="note-drum-band" aria-hidden="true" />
    </div>
  );
}
