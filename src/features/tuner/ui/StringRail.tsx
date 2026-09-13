import { BUILTIN_TUNINGS } from "../../../lib/music";
import type { Tuning, TuningId, TuningStringId, TuningTarget } from "../../../types/tuner";

type StringRailProps = {
  /** 当前调弦解析出的目标列表,轨道由它驱动 */
  targets: readonly TuningTarget[];
  /** 当前激活的调弦 id(预设条高亮用) */
  tuningId: TuningId;
  /** 本地保存的自定义调弦 */
  customTunings: readonly Tuning[];
  activeTargetId: TuningStringId | null;
  /** 手动模式下当前选中的弦(即使还没有检测到音高) */
  selectionTargetId: TuningStringId | null;
  tunedIds: ReadonlySet<TuningStringId>;
  /** 当前检测到的音对应的弦(轻量提示"这是哪根弦") */
  matchedTargetId: TuningStringId | null;
  manualMode: boolean;
  railHint: string;
  onSelectTarget: (id: TuningStringId) => void;
  onSelectTuning: (tuningId: TuningId) => void;
  onDeleteTuning: (tuningId: TuningId) => void;
  onOpenCustomEditor: () => void;
  onEnableAuto: () => void;
};

/**
 * 弦轨道:既是目标导航,也是本会话的调音进度(仅弦模式渲染)。
 * 预设条点击整体覆盖目标;模式开关独立于本组件,由页面级 mode-bar 呈现。
 */
export function StringRail({
  targets,
  tuningId,
  customTunings,
  activeTargetId,
  selectionTargetId,
  tunedIds,
  matchedTargetId,
  manualMode,
  railHint,
  onSelectTarget,
  onSelectTuning,
  onDeleteTuning,
  onOpenCustomEditor,
  onEnableAuto,
}: StringRailProps) {
  const manualTarget = manualMode
    ? (targets.find((target) => target.id === (selectionTargetId ?? activeTargetId)) ??
      null)
    : null;

  const hint = manualMode
    ? manualTarget
      ? `已锁定 ${manualTarget.note}${manualTarget.octave} — 只拨这根弦,点它一次解除`
      : "在下方点一根弦锁定"
    : railHint;

  return (
    <section className="rail-zone" aria-label="调弦目标">
      <div className="preset-bar" role="group" aria-label="调弦预设">
        {BUILTIN_TUNINGS.map((tuning) => (
          <button
            key={tuning.id}
            type="button"
            className="preset-chip"
            aria-pressed={tuning.id === tuningId}
            onClick={() => {
              onSelectTuning(tuning.id);
            }}
          >
            {tuning.name}
          </button>
        ))}

        {customTunings.map((tuning) => (
          <span key={tuning.id} className="preset-chip-group">
            <button
              type="button"
              className="preset-chip preset-chip-custom"
              aria-pressed={tuning.id === tuningId}
              onClick={() => {
                onSelectTuning(tuning.id);
              }}
            >
              {tuning.name}
            </button>
            <button
              type="button"
              className="preset-chip-delete"
              aria-label={`删除调弦 ${tuning.name}`}
              onClick={() => {
                if (window.confirm(`删除自定义调弦 "${tuning.name}"?`)) {
                  onDeleteTuning(tuning.id);
                }
              }}
            >
              ✕
            </button>
          </span>
        ))}

        <button
          type="button"
          className="preset-chip preset-chip-add"
          onClick={onOpenCustomEditor}
        >
          ＋ 自定义
        </button>
      </div>

      <div className="rail-head">
        <h2 className="rail-title">{targets.map((target) => target.note).join(" ")}</h2>
        <div className="rail-controls">
          <p className="rail-hint">{hint}</p>
        </div>
      </div>

      <div
        className="rail"
        style={{ gridTemplateColumns: `repeat(${targets.length}, minmax(0, 1fr))` }}
      >
        {targets.map((target) => {
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
