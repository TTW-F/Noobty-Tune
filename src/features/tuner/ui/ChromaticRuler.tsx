import { CHROMATIC_NOTE_NAMES } from "../../../lib/music/noteMapping";
import type { NoteName } from "../../../types/tuner";
export type ArmedTarget = {
  readonly note: NoteName;
  readonly octave: number;
};

type ChromaticRulerProps = {
  /** 当前检测音的音名(不含八度),如 "G#" */
  detectedNoteClass: NoteName | null;
  /** 已选定的目标音(null = 自动参照最近半音) */
  armed: ArmedTarget | null;
  onArm: (note: NoteName) => void;
  onDisarm: () => void;
};

/**
 * 半音阶音名尺——半音阶调音器的通用部件(GuitarTuna / BOSS Tuner 同款交互):
 * 12 个音名一排,检测音实时高亮;点任意音名把它设为目标音,
 * 指针表随即以该音为参照。再点一次已选定的音取消,回到自动参照。
 */
export function ChromaticRuler({
  detectedNoteClass,
  armed,
  onArm,
  onDisarm,
}: ChromaticRulerProps) {
  return (
    <section className="rail-zone" aria-label="自由模式音名尺">
      <div className="ruler-head">
        {armed ? (
          <>
            <span className="target-chip">
              目标 {armed.note}
              {armed.octave}
            </span>
            <button
              type="button"
              className="target-chip-disarm"
              onClick={onDisarm}
            >
              ✕ 取消目标,回到自动参照
            </button>
          </>
        ) : (
          <p className="ruler-hint">点一个音名,把它设为目标;不选则自动以最近的音为参照</p>
        )}
      </div>

      <div className="chromatic-ruler" role="group" aria-label="半音阶音名">
        {CHROMATIC_NOTE_NAMES.map((noteName) => {
          const isDetected = detectedNoteClass === noteName;
          const isArmed = armed?.note === noteName;
          return (
            <button
              key={noteName}
              type="button"
              className="note-ruler-cell"
              data-detected={isDetected}
              data-armed={isArmed}
              aria-pressed={isArmed}
              onClick={() => {
                if (isArmed) {
                  onDisarm();
                } else {
                  onArm(noteName);
                }
              }}
            >
              <span className="note-ruler-note">{noteName}</span>
              {isArmed ? (
                <span className="note-ruler-octave">{armed.octave}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
