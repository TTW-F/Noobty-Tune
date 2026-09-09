import { AnimatePresence, motion } from "motion/react";
import type { TunerFeedback } from "./feedback";

/**
 * 全页唯一的状态指令行。文案与仪表灯同色、同义。
 */
export function StatusLine({ feedback }: { feedback: TunerFeedback }) {
  return (
    <div
      className="status-line"
      data-tone={feedback.tone}
      role="status"
      aria-live="polite"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={feedback.phase + feedback.headline}
          className="status-line-inner"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.5em" }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
        >
          {feedback.arrow ? (
            <span className="status-line-arrow" aria-hidden="true">
              {feedback.arrow}
            </span>
          ) : null}
          {feedback.headline}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
