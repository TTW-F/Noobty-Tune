import { STANDARD_GUITAR_TUNING } from "../../../lib/music";
import { PageShell } from "../../../components/PageShell";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { StatusCard } from "../../../components/StatusCard";
import type { TunerState, TunerUiStatus } from "../../../types/tuner";

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

function getPromptFromState(state: TunerState): M1Prompt {
  switch (state.uiStatus) {
    case "requesting-permission":
      return {
        key: "requesting-permission",
        label: "\u5f53\u524d\u72b6\u6001",
        title: "\u7b49\u5f85\u9ea6\u514b\u98ce\u6388\u6743",
        description:
          "\u6d4f\u89c8\u5668\u6b63\u5728\u8bf7\u6c42\u9ea6\u514b\u98ce\u6743\u9650\u3002\u5982\u679c\u6ca1\u6709\u770b\u5230\u5f39\u7a97\uff0c\u8bf7\u68c0\u67e5\u5730\u5740\u680f\u9644\u8fd1\u7684\u6743\u9650\u63d0\u793a\u3002",
        hint: "\u6388\u6743\u6210\u529f\u540e\u4f1a\u7acb\u5373\u8fdb\u5165\u76d1\u542c\u51c6\u5907\u72b6\u6001\u3002",
        tone: "info",
      };
    case "permission-denied":
      return {
        key: "permission-denied",
        label: "\u5f53\u524d\u72b6\u6001",
        title: "\u9ea6\u514b\u98ce\u6743\u9650\u88ab\u62d2\u7edd",
        description:
          state.lastError?.message ??
          "\u8bf7\u5728\u6d4f\u89c8\u5668\u8bbe\u7f6e\u4e2d\u91cd\u65b0\u5141\u8bb8\u9ea6\u514b\u98ce\u8bbf\u95ee\u3002",
        hint: "\u8bf7\u786e\u8ba4\u5f53\u524d\u9875\u9762\u8fd0\u884c\u5728 localhost \u6216 HTTPS \u73af\u5883\u4e0b\u3002",
        tone: "error",
      };
    case "listening":
      return {
        key: "listening",
        label: "\u5f53\u524d\u72b6\u6001",
        title: "\u5df2\u5f00\u59cb\u76d1\u542c",
        description:
          "M1 \u7684\u9ea6\u514b\u98ce\u6743\u9650\u4e0e AudioContext \u6d41\u7a0b\u5df2\u7ecf\u8dd1\u901a\u3002",
        hint: "\u4e0b\u4e00\u6b65\u5c06\u63a5\u5165\u97f3\u9891\u5e27\u91c7\u96c6\u3001YIN \u5019\u9009\u68c0\u6d4b\u548c\u7a33\u5b9a\u5316\u7b56\u7565\u3002",
        tone: "info",
      };
    case "error":
      return {
        key: "error",
        label: "\u5f53\u524d\u72b6\u6001",
        title: "\u97f3\u9891\u521d\u59cb\u5316\u5931\u8d25",
        description:
          state.lastError?.message ??
          "\u521d\u59cb\u5316\u97f3\u9891\u65f6\u51fa\u73b0\u9519\u8bef\uff0c\u8bf7\u5237\u65b0\u9875\u9762\u540e\u91cd\u8bd5\u3002",
        hint: "\u5982\u95ee\u9898\u6301\u7eed\u5b58\u5728\uff0c\u8bf7\u5148\u786e\u8ba4\u6d4f\u89c8\u5668\u662f\u5426\u652f\u6301\u9ea6\u514b\u98ce\u548c AudioContext\u3002",
        tone: "error",
      };
    default:
      return M1_PROMPTS[0];
  }
}

type TunerLandingScreenProps = {
  state: TunerState;
  isStarting: boolean;
  onStart: () => void | Promise<void>;
  onReset: () => void | Promise<void>;
};

export function TunerLandingScreen({
  state,
  isStarting,
  onStart,
  onReset,
}: TunerLandingScreenProps) {
  const currentPrompt = getPromptFromState(state);

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
          disabled={isStarting}
          onClick={() => {
            void onStart();
          }}
        >
          {isStarting ? "\u8bf7\u6c42\u6743\u9650\u4e2d..." : "\u5f00\u59cb\u8c03\u97f3"}
        </PrimaryButton>

        <p id="permission-note" className="permission-note">
          {"\u4ec5\u5728\u4f60\u4e3b\u52a8\u70b9\u51fb\u540e\u8bf7\u6c42\u9ea6\u514b\u98ce\u6743\u9650\u3002\u6388\u6743\u6210\u529f\u540e\uff0c\u4f1a\u8fdb\u5165\u76d1\u542c\u51c6\u5907\u72b6\u6001\u3002"}
        </p>

        <div
          className="reference-strip"
          aria-label="\u6807\u51c6\u8c03\u5f26\u53c2\u8003"
        >
          {STANDARD_GUITAR_TUNING.map((target) => (
            <span key={target.id} className="reference-pill">
              {target.note}
              {target.octave}
            </span>
          ))}
        </div>

        <div
          className="status-stack"
          aria-label="\u8c03\u97f3\u5668\u72b6\u6001\u63d0\u793a"
        >
          <StatusCard
            key={currentPrompt.key}
            label={currentPrompt.label}
            title={currentPrompt.title}
            description={currentPrompt.description}
            hint={currentPrompt.hint}
            tone={currentPrompt.tone}
          />
          <StatusCard
            label="\u4e0b\u4e00\u6b65"
            title="M2 \u68c0\u6d4b\u9a8c\u8bc1"
            description="\u5f53\u524d M1 \u9875\u9762\u5df2\u5177\u5907\u5165\u53e3\u3001\u6743\u9650\u72b6\u6001\u5361\u7247\u548c\u97f3\u9891\u521d\u59cb\u5316\u6d41\u7a0b\u3002"
            hint="\u540e\u7eed\u5c06\u5728\u6b64\u57fa\u7840\u4e0a\u63a5\u5165\u97f3\u9891\u5e27\u91c7\u96c6\u3001YIN \u5019\u9009\u68c0\u6d4b\u548c\u72b6\u6001\u7a33\u5b9a\u5316\u3002"
            tone="neutral"
          />
        </div>

        {(state.uiStatus === "permission-denied" || state.uiStatus === "error") && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              void onReset();
            }}
          >
            {"\u91cd\u7f6e\u72b6\u6001"}
          </button>
        )}
      </div>
    </PageShell>
  );
}
