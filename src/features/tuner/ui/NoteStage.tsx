import { AnimatePresence, motion } from "motion/react";
import type { TunerFeedback } from "./feedback";
import { StringLine } from "./StringLine";
import type { LiveAudioSample } from "../model/useTunerPrototype";

type NoteStageProps = {
  feedback: TunerFeedback;
  targetLabel: string | null;
  liveRef: { readonly current: LiveAudioSample };
};

/**
 * 舞台:一个大音符 + 一行数据 + 一根会振动的弦。
 * 音符只在换名时过渡,避免 13Hz 帧更新造成的闪烁。
 */
export function NoteStage({ feedback, targetLabel, liveRef }: NoteStageProps) {
  const noteKey = `${feedback.noteLabel}${feedback.octaveLabel ?? ""}`;

  return (
    <section className="stage" aria-label="当前检测音高">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p
          key={noteKey}
          className="stage-note"
          data-tone={feedback.noteLabel === "—" ? "none" : feedback.tone}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <span>{feedback.noteLabel}</span>
          {feedback.isSharpNote ? (
            <span className="stage-note-sharp-sign">♯</span>
          ) : null}
          {feedback.octaveLabel ? (
            <span className="stage-note-octave">{feedback.octaveLabel}</span>
          ) : null}
          {feedback.showInTuneBadge ? <span className="stage-note-check">✓</span> : null}
        </motion.p>
      </AnimatePresence>

      <StringLine liveRef={liveRef} />

      <div className="stage-data">
        {feedback.frequencyLabel ? <strong>{feedback.frequencyLabel}</strong> : <span>— Hz</span>}
        {feedback.centsLabel ? (
          <span className="stage-data-cents" data-tone={feedback.tone}>
            {feedback.centsLabel}
          </span>
        ) : null}
        {targetLabel ? <span>目标 {targetLabel}</span> : <span>目标 待锁定</span>}
      </div>
    </section>
  );
}
