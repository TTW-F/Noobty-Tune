import { STANDARD_GUITAR_TUNING } from "../../../lib/music";
import type { TuningStringId } from "../../../types/tuner";

type StringRailProps = {
  activeTargetId: TuningStringId | null;
  /** 手动模式下当前选中的弦(即使还没有检测到音高) */
  selectionTargetId: TuningStringId | null;
  tunedIds: ReadonlySet<TuningStringId>;
  /** 当前检测到的音对应的弦(轻量提示"这是哪根弦") */
  matchedTargetId: TuningStringId | null;
  manualMode: boolean;
  railHint: string;
  onSelectTarget: (id: TuningStringId) => void;
  onEnableAuto: () => void;
  onEnterManual: () => void;
};

/**
 * 六弦轨道:既是目标导航,也是本会话的调音进度。
 * 模式开关显式放在轨道上方——自动跟随识别你拨的弦,手动选弦固定一根。
 */
export function StringRail({
  activeTargetId,
  selectionTargetId,
  tunedIds,
  matchedTargetId,
  manualMode,
  railHint,
  onSelectTarget,
  onEnableAuto,
  onEnterManual,
}: StringRailProps) {
  const manualTarget = manualMode
    ? (STANDARD_GUITAR_TUNING.find((target) => target.id === (selectionTargetId ?? activeTargetId)) ??
      null)
    : null;

  const hint = manualMode
    ? manualTarget
      ? `已锁定 ${manualTarget.note}${manualTarget.octave} — 只拨这根弦,点它一次解除`
      : "在下方点一根弦锁定"
    : railHint;

  return (
    <section className="rail-zone" aria-label="标准调弦目标">
      <div className="rail-head">
        <h2 className="rail-title">E A D G B E</h2>
        <div className="rail-controls">
          <div className="mode-switch" role="group" aria-label="选弦模式">
            <button
              type="button"
              aria-pressed={!manualMode}
              onClick={onEnableAuto}
            >
              自动跟随
            </button>
            <button
              type="button"
              aria-pressed={manualMode}
              onClick={onEnterManual}
            >
              手动选弦
            </button>
          </div>
          <p className="rail-hint">{hint}</p>
        </div>
      </div>

      <div className="rail">
        {STANDARD_GUITAR_TUNING.map((target) => {
          const isTarget = activeTargetId === target.id;
          const isMatched = matchedTargetId === target.id;
          return (
            <button
              key={target.id}
              type="button"
              className="string-cell"
              data-target={isTarget}
              data-tuned={tunedIds.has(target.id)}
              data-active-pitch={!isTarget && isMatched}
              onClick={() => {
                if (manualMode && isTarget) {
                  onEnableAuto();
                } else {
                  onSelectTarget(target.id);
                }
              }}
              aria-pressed={isTarget}
            >
              <span className="string-cell-flag" aria-hidden="true" />
              <span className="string-cell-num">{target.label} 弦</span>
              <span className="string-cell-note">
                {target.note}
                {target.octave}
              </span>
              <span className="string-cell-freq">{target.frequencyHz.toFixed(1)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
