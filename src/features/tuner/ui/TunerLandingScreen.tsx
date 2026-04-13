import type { TunerUiStatus } from "../../../types/tuner";
import { PageShell } from "../../../components/PageShell";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { StatusCard } from "../../../components/StatusCard";

type M1Prompt = {
  key: TunerUiStatus | "permission-prompt";
  label: string;
  title: string;
  description: string;
  hint?: string;
  tone?: "neutral" | "info" | "warning" | "error";
};

const M1_PROMPTS: M1Prompt[] = [
  {
    key: "idle",
    label: "\u5f53\u524d\u72b6\u6001",
    title: "\u51c6\u5907\u5f00\u59cb",
    description:
      "\u70b9\u51fb\u201c\u5f00\u59cb\u8c03\u97f3\u201d\u540e\u8fdb\u5165\u6388\u6743\u6d41\u7a0b\uff0c\u968f\u540e\u4f1a\u63d0\u793a\u4f60\u5355\u72ec\u62e8\u52a8\u4e00\u6839\u7434\u5f26\u3002",
    hint: "\u5efa\u8bae\u5728\u76f8\u5bf9\u5b89\u9759\u7684\u73af\u5883\u4e2d\u4f7f\u7528\uff0c\u5e76\u8ba9\u7434\u5934\u9760\u8fd1\u8bbe\u5907\u9ea6\u514b\u98ce\u3002",
    tone: "info",
  },
  {
    key: "permission-prompt",
    label: "\u6743\u9650\u63d0\u793a",
    title: "\u7b49\u5f85\u9ea6\u514b\u98ce\u6388\u6743",
    description:
      "\u5982\u679c\u6d4f\u89c8\u5668\u5f39\u51fa\u6743\u9650\u7a97\u53e3\uff0c\u8bf7\u9009\u62e9\u5141\u8bb8\u3002\u82e5\u672a\u770b\u5230\u5f39\u7a97\uff0c\u8bf7\u68c0\u67e5\u5730\u5740\u680f\u9644\u8fd1\u7684\u6743\u9650\u63d0\u793a\u3002",
    tone: "neutral",
  },
];

const STANDARD_TUNING = ["E2", "A2", "D3", "G3", "B3", "E4"];

export function TunerLandingScreen() {
  return (
    <PageShell
      eyebrow="Web M1 Prototype"
      title="Noobty Tune"
      description="\u5728\u6d4f\u89c8\u5668\u91cc\u5feb\u901f\u7ed9\u5409\u4ed6\u8c03\u97f3\u3002\u70b9\u51fb\u5f00\u59cb\u540e\uff0c\u6211\u4eec\u4f1a\u8bf7\u6c42\u9ea6\u514b\u98ce\u6743\u9650\u3002"
    >
      <div className="tuner-launch-panel">
        <div
          className="trust-note"
          aria-label="\u672c\u5730\u5904\u7406\u8bf4\u660e"
        >
          {"\u97f3\u9891\u4ec5\u5728\u6d4f\u89c8\u5668\u672c\u5730\u5904\u7406\uff0c\u4e0d\u4f1a\u5728\u9875\u9762\u52a0\u8f7d\u65f6\u81ea\u52a8\u8bf7\u6c42\u6743\u9650\u3002"}
        </div>

        <PrimaryButton
          aria-describedby="permission-note"
          className="tuner-launch-button"
        >
          {"\u5f00\u59cb\u8c03\u97f3"}
        </PrimaryButton>

        <p id="permission-note" className="permission-note">
          {"\u4ec5\u5728\u4f60\u4e3b\u52a8\u70b9\u51fb\u540e\u8bf7\u6c42\u9ea6\u514b\u98ce\u6743\u9650\u3002\u6388\u6743\u6210\u529f\u540e\uff0c\u4f1a\u8fdb\u5165\u76d1\u542c\u51c6\u5907\u72b6\u6001\u3002"}
        </p>

        <div
          className="reference-strip"
          aria-label="\u6807\u51c6\u8c03\u5f26\u53c2\u8003"
        >
          {STANDARD_TUNING.map((note) => (
            <span key={note} className="reference-pill">
              {note}
            </span>
          ))}
        </div>

        <div
          className="status-stack"
          aria-label="\u8c03\u97f3\u5668\u72b6\u6001\u63d0\u793a"
        >
          {M1_PROMPTS.map((prompt) => (
            <StatusCard
              key={prompt.key}
              label={prompt.label}
              title={prompt.title}
              description={prompt.description}
              hint={prompt.hint}
              tone={prompt.tone}
            />
          ))}
        </div>
      </div>
    </PageShell>
  );
}
