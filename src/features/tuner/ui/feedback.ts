import type {
  PitchTrackingState,
  RawPitchCandidate,
  TuningInterpretation,
  TunerViewModel,
} from "../../../types/pitchTracking";
import type { NoteName, TunerState } from "../../../types/tuner";
import { getCentsOffset, midiToFrequency, noteNameToMidi, parseNoteCode } from "../../../lib/music";

/**
 * 全站唯一的调音反馈推导。
 *
 * 反馈原则:任何时刻屏幕上只有一个音名、一条音分刻度、一句中文指令。
 * 偏低 = 拧紧(蓝),偏高 = 放松(红),锁定 ±5 音分 = 已准(绿)。
 */

export type FeedbackTone = "idle" | "flat" | "sharp" | "true" | "warn" | "error";

export type TunerFeedback = {
  /** 状态相位,用于过渡动画 key */
  readonly phase: string;
  readonly tone: FeedbackTone;
  /** 当前模式徽标:自动跟随 / 手动选弦 / 自由模式 */
  readonly modeLabel: string;
  /** 舞台大音符,如 "E";无信号为 "--" */
  readonly noteLabel: string;
  readonly octaveLabel: number | null;
  readonly isSharpNote: boolean;
  /** 已准时在音符旁亮出对勾 */
  readonly showInTuneBadge: boolean;
  readonly frequencyLabel: string | null;
  readonly centsLabel: string | null;
  /** 指针位置,音分线性映射,-50..50 */
  readonly needlePercent: number;
  readonly needleActive: boolean;
  /** 唯一指令句 */
  readonly headline: string;
  readonly arrow: "◀" | "▶" | "✓" | null;
  /** 当前目标弦,如 "E2 · 6弦" */
  readonly targetLabel: string | null;
  /** 六弦轨道上方的模式提示 */
  readonly railHint: string;
  readonly micLive: boolean;
};

const WEAK_RMS = 0.003;
const SILENT_RMS = 0.0008;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatCents(cents: number) {
  const rounded = Math.round(cents);
  if (rounded === 0) {
    return "0¢";
  }
  return rounded > 0 ? `+${rounded}¢` : `${rounded}¢`;
}

function getTargetLabel(state: TunerState, viewModel: TunerViewModel): string | null {
  const target = state.activeTarget;
  if (target) {
    return `${target.note}${target.octave} · ${target.label}弦`;
  }
  if (viewModel.displayTarget) {
    return viewModel.displayTarget;
  }
  return null;
}

/**
 * 引擎的 detectedNote 是 "E2"/"F#" 这种音名代码,
 * 舞台大音符需要拆成 音名 + 八度下标,否则会渲染成 "E22"。
 * 解析统一走 lib/music 的 parseNoteCode。
 */

export function deriveFeedback(input: {
  state: TunerState;
  viewModel: TunerViewModel;
  interpretation: TuningInterpretation | null;
  trackingState: PitchTrackingState | null;
  rawCandidate: RawPitchCandidate | null;
  frameRms: number | null | undefined;
  /** 兼容旧调用方;模式以 state.selection.mode 为准 */
  manualMode?: boolean;
  chromaticMode?: boolean;
  /** 自由模式下被选定的目标音(null = 自动参照最近半音) */
  chromaticTargetNote: { note: NoteName; octave: number } | null;
}): TunerFeedback {
  const { state, viewModel, interpretation, trackingState, rawCandidate, chromaticTargetNote } = input;
  const manualMode = state.selection.mode === "manual";
  const chromaticMode = state.selection.mode === "chromatic";
  const frameRms = typeof input.frameRms === "number" ? input.frameRms : 0;

  const trackedHz = trackingState?.trackedFrequencyHz ?? null;
  const rawHz = rawCandidate?.frequencyHz ?? null;
  const hasPitch = trackedHz !== null || rawHz !== null;

  const autoHint = chromaticMode
    ? "自由模式 · 点琴弦可切手动锁定"
    : "自动跟随 · 点击琴弦可手动锁定";

  const base = {
    octaveLabel: null as number | null,
    isSharpNote: false,
    showInTuneBadge: false,
    frequencyLabel: null as string | null,
    centsLabel: null as string | null,
    needlePercent: 0,
    needleActive: false,
    arrow: null as TunerFeedback["arrow"],
    targetLabel: getTargetLabel(state, viewModel),
    modeLabel: chromaticMode ? "自由模式" : manualMode ? "手动选弦" : "自动跟随",
    micLive:
      state.audioStatus === "listening" ||
      state.audioStatus === "ready" ||
      state.audioStatus === "suspended",
  };

  // ---- 授权与错误:优先级最高 ------------------------------------
  if (state.audioStatus === "requesting-permission") {
    return {
      ...base,
      phase: "permission",
      tone: "idle",
      noteLabel: "—",
      headline: "正在请求麦克风授权…",
      railHint: "授权后开始调音",
    };
  }

  if (state.audioStatus === "permission-denied" || state.uiStatus === "permission-denied") {
    return {
      ...base,
      phase: "denied",
      tone: "error",
      noteLabel: "—",
      headline: "麦克风被拒绝 — 在浏览器地址栏的权限设置里允许后重试",
      railHint: "需要麦克风权限",
    };
  }

  if (state.audioStatus === "error" || state.uiStatus === "error") {
    return {
      ...base,
      phase: "error",
      tone: "error",
      noteLabel: "—",
      headline: "音频初始化失败 — 刷新页面后重新开始",
      railHint: "会话异常",
    };
  }

  if (!base.micLive) {
    return {
      ...base,
      phase: "idle",
      tone: "idle",
      noteLabel: "—",
      headline: "点击开始,授权麦克风后拨弦即测",
      railHint: autoHint,
    };
  }

  // ---- 已在监听 -------------------------------------------------
  const liveHz = trackedHz ?? rawHz;
  const frequencyLabel =
    typeof liveHz === "number" ? `${liveHz >= 100 ? liveHz.toFixed(1) : liveHz.toFixed(2)} Hz` : null;

  const parsedNote = parseNoteCode(interpretation?.detectedNote ?? "");
  const nearestNote =
    parsedNote?.note ??
    state.stabilizedPitch?.noteName ??
    state.detectedPitch?.noteName ??
    null;
  const nearestOctave =
    parsedNote?.octave ??
    state.stabilizedPitch?.octave ??
    state.detectedPitch?.octave ??
    null;
  const nearestSharp = parsedNote?.sharp ?? false;
  const nearestCode =
    parsedNote && parsedNote.octave !== null
      ? `${parsedNote.note}${parsedNote.octave}`
      : nearestNote;

  // 自由模式的"目标"就是最近的半音名——目标栏要随时反映参照物,而不是显示"待锁定"
  const referenceCode = chromaticTargetNote
    ? `${chromaticTargetNote.note}${chromaticTargetNote.octave}`
    : nearestCode;
  const chromaticTargetLabel =
    chromaticMode && referenceCode
      ? chromaticTargetNote
        ? referenceCode
        : `${referenceCode} · 自由`
      : null;
  // 参照物确定后统一覆盖目标栏,后面的分支不再各自判断模式
  base.targetLabel = chromaticMode ? chromaticTargetLabel : base.targetLabel;

  if (!hasPitch) {
    if (frameRms <= SILENT_RMS) {
      return {
        ...base,
        phase: "silent",
        tone: "warn",
        noteLabel: "—",
        headline: "麦克风没听到声音 — 换一个输入设备,或把琴靠近一点",
        railHint: "输入静默",
      };
    }
    if (frameRms <= WEAK_RMS || state.uiStatus === "signal-weak") {
      return {
        ...base,
        phase: "weak",
        tone: "warn",
        noteLabel: "—",
        headline: "声音太弱 — 琴再靠近麦克风,拨弦清晰一些",
        railHint: "输入偏弱",
      };
    }
    if (state.uiStatus === "no-signal") {
      return {
        ...base,
        phase: "noisy",
        tone: "warn",
        noteLabel: "—",
        headline: "环境太吵,锁不住单音 — 只拨一根弦",
        railHint: "信号混杂",
      };
    }
    return {
      ...base,
      phase: "listening",
      tone: "idle",
      noteLabel: "—",
      headline: "拨一根弦,让它响",
      railHint: autoHint,
    };
  }

  // ---- 有音高 ---------------------------------------------------
  const stage = viewModel.uiStage;

  if (stage === "acquiring" || stage === "tracking") {
    return {
      ...base,
      phase: stage,
      tone: "idle",
      noteLabel: nearestNote ?? "--",
      octaveLabel: nearestOctave,
      isSharpNote: nearestSharp,
      frequencyLabel,
      needlePercent: 0,

      headline: stage === "acquiring" ? "听到了 — 让这个音再多响一会儿" : "正在锁定 — 保持住",
      railHint: autoHint,
    };
  }

  if (stage === "degraded") {
    return {
      ...base,
      phase: "degraded",
      tone: "warn",
      noteLabel: nearestNote ?? "--",
      octaveLabel: nearestOctave,
      isSharpNote: nearestSharp,
      frequencyLabel,
      centsLabel: interpretation?.centsOffset !== null && interpretation?.centsOffset !== undefined
        ? formatCents(interpretation.centsOffset)
        : null,

      headline: "信号在变弱 — 延音不够了,重新拨一次",
      railHint: "延音衰减",
    };
  }

  if (stage === "lost" || stage === "idle") {
    return {
      ...base,
      phase: "lost",
      tone: "idle",
      noteLabel: nearestNote ?? "--",
      octaveLabel: nearestOctave,
      isSharpNote: nearestSharp,
      frequencyLabel,

      headline: "余音结束了 — 再拨一次",
      railHint: "等待拨弦",
    };
  }

  // ---- locked:给出方向指令 --------------------------------------
  let cents = interpretation?.centsOffset ?? state.deviation?.cents ?? null;
  let direction = interpretation?.direction ?? "unknown";

  // 自由模式选定了目标音:音分与方向都以它为参照重算,
  // 检测音离目标超过半音时,指针表依然给出指向目标的真实距离。
  if (chromaticMode && chromaticTargetNote) {
    const referenceHz = midiToFrequency(
      noteNameToMidi(chromaticTargetNote.note, chromaticTargetNote.octave),
    );
    const liveHz = trackedHz ?? rawHz;
    if (liveHz !== null) {
      cents = getCentsOffset(liveHz, referenceHz);
      direction = Math.abs(cents) <= 5 ? "in-tune" : cents < 0 ? "flat" : "sharp";
    }
  }

  const targetCode = state.activeTarget
    ? `${state.activeTarget.note}${state.activeTarget.octave}`
    : null;
  const wrongNote =
    manualMode && targetCode !== null && nearestCode !== null && nearestCode !== targetCode;

  const needlePercent =
    cents === null ? 0 : clamp(cents / 50, -1, 1) * 50;

  if (wrongNote) {
    return {
      ...base,
      phase: "wrong-note",
      tone: "warn",
      noteLabel: nearestNote ?? "--",
      octaveLabel: nearestOctave,
      isSharpNote: nearestSharp,
      frequencyLabel,
      needlePercent: 0,
      needleActive: true,
      headline: `这是 ${targetCode} 以外的音 — 请只拨目标弦`,
      railHint: "手动选弦中",
    };
  }

  if (direction === "in-tune" && cents !== null) {
    return {
      ...base,
      phase: "in-tune",
      tone: "true",
      noteLabel: nearestNote ?? "--",
      octaveLabel: nearestOctave,
      isSharpNote: nearestSharp,
      showInTuneBadge: true,
      frequencyLabel,
      centsLabel: formatCents(cents),
      needlePercent,
      needleActive: true,
      arrow: "✓",

      headline: chromaticMode
        ? `${referenceCode ?? "这个音"} 音准了`
        : "音准了 — 这根弦 OK,调下一根",
      railHint: manualMode ? "手动选弦 · 只拨目标弦" : autoHint,
    };
  }

  const isFlat = direction === "flat" || (cents !== null && cents < 0);
  const chromaticHeadline = chromaticMode && referenceCode
    ? isFlat
      ? `偏低 — 拧紧到 ${referenceCode}`
      : `偏高 — 放松到 ${referenceCode}`
    : null;

  return {
    ...base,
    phase: isFlat ? "flat" : "sharp",
    tone: isFlat ? "flat" : "sharp",
    noteLabel: nearestNote ?? "--",
    octaveLabel: nearestOctave,
    isSharpNote: nearestSharp,
    frequencyLabel,
    centsLabel: cents === null ? null : formatCents(cents),
    needlePercent,
    needleActive: true,
    arrow: isFlat ? "◀" : "▶",
    headline: chromaticHeadline ?? (isFlat ? "偏低 — 拧紧琴弦" : "偏高 — 放松琴弦"),
    railHint: manualMode ? "手动选弦 · 只拨目标弦" : autoHint,
  };
}
