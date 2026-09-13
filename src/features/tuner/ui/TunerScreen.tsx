import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_TUNING_ID, parseNoteCode, pickOctaveForNote } from "../../../lib/music";
import type { AudioInputDevice } from "../../../lib/audio";
import type { DebugReadoutData } from "../../../components/DebugReadoutCard";
import type { DeveloperLogEntry } from "../../../lib/logging/developerLogger";
import type { LiveAudioSample } from "../model/useTunerPrototype";
import { EMPTY_LIVE_SAMPLE } from "../model/useTunerPrototype";
import type {
  PitchTrackingState,
  RawPitchCandidate,
  TuningInterpretation,
  TunerViewModel,
} from "../../../types/pitchTracking";
import type {
  NoteName,
  TunerState,
  Tuning,
  TuningId,
  TuningStringId,
  TuningStringSpec,
  TuningTarget,
} from "../../../types/tuner";
import { deriveFeedback } from "./feedback";
import { ChromaticRuler, type ArmedTarget } from "./ChromaticRuler";
import { CustomTuningEditor } from "./CustomTuningEditor";
import { DebugDrawer } from "./DebugDrawer";
import { MicPopover } from "./MicPopover";
import { NoteStage } from "./NoteStage";
import { StatusLine } from "./StatusLine";
import { StringRail } from "./StringRail";
import { TunerMeter } from "./TunerMeter";
import { DEMO_SCENARIOS, DEMO_TARGETS } from "./demo";

export type TunerScreenProps = {
  state: TunerState;
  /** 当前调弦解析出的目标频率列表,轨道与大音符匹配都由它驱动 */
  targets: readonly TuningTarget[];
  /** 本地保存的自定义调弦 */
  customTunings: readonly Tuning[];
  rawCandidate: RawPitchCandidate | null;
  trackingState: PitchTrackingState | null;
  interpretation: TuningInterpretation | null;
  viewModel: TunerViewModel;
  isStarting: boolean;
  liveRef: { current: LiveAudioSample };
  onStart: () => void | Promise<void>;
  onReset: () => void | Promise<void>;
  onRefreshInputs: () => void | Promise<unknown>;
  onSelectInput: (deviceId: string) => void | Promise<void>;
  onSelectTuning: (tuningId: TuningId) => void;
  onSaveCustomTuning: (strings: readonly TuningStringSpec[], name: string) => void;
  onDeleteTuning: (tuningId: TuningId) => void;
  onEnableAutoTargetMode: () => void;
  onEnableChromaticMode: () => void;
  onSelectManualTarget: (targetId: TuningStringId) => void;
  debugReadout: DebugReadoutData;
  developerLogs: readonly DeveloperLogEntry[];
  availableInputs: readonly AudioInputDevice[];
  selectedInputDeviceId: string | null;
  activeInputLabel: string | null;
};

function readDemoKey(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const key = new URLSearchParams(window.location.search).get("demo");
  return key && key in DEMO_SCENARIOS ? key : null;
}

/**
 * 单屏调音器:大音符 → 音分刻度带 → 一句指令 → 六弦轨道。
 * 所有旧版冗余面板收敛为这四层。
 */
export function TunerScreen(props: TunerScreenProps) {
  const demoKey = useMemo(() => readDemoKey(), []);
  const demo = demoKey ? DEMO_SCENARIOS[demoKey] : null;

  const state = demo ? demo.state : props.state;
  const viewModel = demo ? demo.viewModel : props.viewModel;
  const interpretation = demo ? demo.interpretation : props.interpretation;
  const trackingState = demo ? demo.trackingState : props.trackingState;
  const rawCandidate = demo ? demo.rawCandidate : props.rawCandidate;
  const targets = demo ? DEMO_TARGETS : props.targets;
  const frameRms = demo ? demo.frameRms : (props.debugReadout.frameRms ?? null);
  const isStarting = demo ? false : props.isStarting;
  const activeInputLabel = demo ? demo.activeInputLabel : props.activeInputLabel;
  const availableInputs = demo ? [] : props.availableInputs;
  const selectedInputDeviceId = demo ? null : props.selectedInputDeviceId;
  const debugReadout = demo
    ? { ...props.debugReadout, frameRms: demo.frameRms }
    : props.debugReadout;
  const developerLogs = demo ? [] : props.developerLogs;

  // demo 时用夹具 ref,真实模式直接透传引擎的 liveRef(渲染期不读 .current)
  const demoLiveRef = useRef<LiveAudioSample>(
    demo ? demo.liveSample : EMPTY_LIVE_SAMPLE,
  );
  const liveRef = demo ? demoLiveRef : props.liveRef;

  const manualMode = state.selection.mode === "manual";
  const chromaticMode = state.selection.mode === "chromatic";

  // 自由模式下被选定的目标音(null = 自动参照最近半音;切回弦模式即清除)
  const [armedTarget, setArmedTarget] = useState<ArmedTarget | null>(null);
  // 自定义调弦编辑器
  const [editorOpen, setEditorOpen] = useState(false);

  const feedback = deriveFeedback({
    state,
    viewModel,
    interpretation,
    trackingState,
    rawCandidate,
    frameRms,
    manualMode,
    chromaticMode,
    chromaticTargetNote: chromaticMode ? armedTarget : null,
  });

  // 本会话已调好的弦(锁定 ±5 音分即标记)。
  const [tunedIds, setTunedIds] = useState<ReadonlySet<TuningStringId>>(new Set());

  // 换调弦时,目标频率没变的弦保留"已调"标记(Drop D 只丢 6 弦的进度)。
  const prevTargetsRef = useRef<readonly TuningTarget[]>(targets);
  useEffect(() => {
    const previousTargets = prevTargetsRef.current;
    if (previousTargets === targets) {
      return;
    }
    prevTargetsRef.current = targets;
    setTunedIds((current) => {
      const kept = new Set<TuningStringId>();
      for (const id of current) {
        const before = previousTargets.find((target) => target.id === id);
        const after = targets.find((target) => target.id === id);
        if (
          before &&
          after &&
          Math.abs(before.frequencyHz - after.frequencyHz) < 0.01
        ) {
          kept.add(id);
        }
      }
      return kept.size === current.size ? current : kept;
    });
  }, [targets]);

  const tunedTargetId =
    feedback.tone === "true" && state.activeTarget ? state.activeTarget.id : null;
  // 渲染期条件更新(React 官方 "adjusting state on prop change" 模式),不用 effect。
  if (tunedTargetId && !tunedIds.has(tunedTargetId)) {
    const next = new Set(tunedIds);
    next.add(tunedTargetId);
    setTunedIds(next);
  }

  // 检测到的音对应哪根弦(轨道上的轻量提示)
  const matchedTargetId = useMemo(() => {
    const note = state.stabilizedPitch?.noteName ?? state.detectedPitch?.noteName;
    const octave = state.stabilizedPitch?.octave ?? state.detectedPitch?.octave;
    if (!note || typeof octave !== "number") {
      return null;
    }
    return (
      targets.find((target) => target.note === note && target.octave === octave)?.id ??
      null
    );
  }, [targets, state.stabilizedPitch, state.detectedPitch]);

  // 自由模式音名尺需要:检测音的音名(不含八度)与频率(配八度用)
  const detectionFrequencyHz =
    state.stabilizedPitch?.frequencyHz ?? state.detectedPitch?.frequencyHz ?? null;
  const detectionNoteName = state.stabilizedPitch?.noteName ?? state.detectedPitch?.noteName ?? null;
  // interpretation.detectedNote("G#2")比 reading 的 noteName 更新更及时,优先解析它
  const chromaticNoteClass: NoteName | null =
    parseNoteCode(interpretation?.detectedNote ?? "")?.note ?? detectionNoteName;

  const level = Math.min(1, (frameRms ?? 0) / 0.03);
  const micLive = feedback.micLive;
  const canStart = !isStarting && !micLive && state.audioStatus !== "requesting-permission";
  const startLabel = isStarting
    ? "请求权限中…"
    : state.audioStatus === "permission-denied"
      ? "重新允许并开始"
      : "开始调音";

  return (
    <div
      className="app-frame"
      data-mode={state.selection.mode}
      data-demo={demo ? "true" : undefined}
    >
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            NOOBTY <em>TUNE</em>
          </span>
          <span className="brand-note">吉他调音器 · 纯本地处理 · 不上传</span>
        </div>
        <div className="topbar-side">
          <MicPopover
            availableInputs={availableInputs}
            selectedInputDeviceId={selectedInputDeviceId}
            activeInputLabel={activeInputLabel}
            level={level}
            micLive={micLive}
            onRefresh={() => {
              void props.onRefreshInputs();
            }}
            onSelect={(deviceId) => {
              void props.onSelectInput(deviceId);
            }}
          />
        </div>
      </header>

      {/* 模式开关独立成行:三种模式同位切换,立即可见。demo 夹具锁定展示,不提供切换 */}
      <div className="mode-bar">
        {demo ? (
          <span className="mode-bar-demo-note">demo 模式:{demoKey} — 数据为固定夹具</span>
        ) : (
          <div className="mode-switch" role="group" aria-label="调音模式">
            <button
              type="button"
              aria-pressed={!manualMode && !chromaticMode}
              onClick={() => {
                setArmedTarget(null);
                props.onEnableAutoTargetMode();
              }}
            >
              自动跟随
            </button>
            <button
              type="button"
              aria-pressed={manualMode}
              onClick={() => {
                setArmedTarget(null);
                props.onSelectManualTarget(
                  state.selection.targetId ??
                    state.activeTarget?.id ??
                    targets[0]?.id ??
                    "string-6",
                );
              }}
            >
              手动选弦
            </button>
            <button
              type="button"
              aria-pressed={chromaticMode}
              onClick={() => {
                setArmedTarget(null);
                props.onEnableChromaticMode();
              }}
            >
              自由模式
            </button>
          </div>
        )}
      </div>

      <NoteStage
        feedback={feedback}
        targetLabel={feedback.targetLabel}
        liveRef={liveRef}
      />

      <div className="meter-wrap">
        <TunerMeter
          tone={feedback.tone}
          needlePercent={feedback.needlePercent}
          needleActive={feedback.needleActive}
        />
      </div>

      <StatusLine feedback={feedback} />

      {chromaticMode ? (
        <ChromaticRuler
          detectedNoteClass={chromaticNoteClass}
          armed={demo ? null : armedTarget}
          onArm={
            demo
              ? () => {}
              : (note: NoteName) => {
                  const octave = pickOctaveForNote(note, detectionFrequencyHz);
                  setArmedTarget({ note, octave });
                }
          }
          onDisarm={
            demo
              ? () => {}
              : () => {
                  setArmedTarget(null);
                }
          }
        />
      ) : (
        <div className="rail-zone" data-demo={demo ? "true" : undefined}>
          <StringRail
            targets={targets}
            tuningId={demo ? DEFAULT_TUNING_ID : state.selection.tuningId}
            customTunings={demo ? [] : props.customTunings}
            activeTargetId={state.activeTarget?.id ?? null}
            selectionTargetId={state.selection.targetId}
            tunedIds={tunedIds}
            matchedTargetId={matchedTargetId}
            manualMode={manualMode}
            railHint={feedback.railHint}
            onSelectTarget={(id) => {
              if (!demo) {
                props.onSelectManualTarget(id);
              }
            }}
            onSelectTuning={(id) => {
              if (!demo) {
                props.onSelectTuning(id);
              }
            }}
            onDeleteTuning={(id) => {
              if (!demo) {
                props.onDeleteTuning(id);
              }
            }}
            onOpenCustomEditor={() => {
              if (!demo) {
                setEditorOpen(true);
              }
            }}
            onEnableAuto={() => {
              if (!demo) {
                props.onEnableAutoTargetMode();
              }
            }}
          />
        </div>
      )}

      {editorOpen ? (
        <CustomTuningEditor
          onCancel={() => {
            setEditorOpen(false);
          }}
          onSave={(strings, name) => {
            setEditorOpen(false);
            props.onSaveCustomTuning(strings, name);
          }}
        />
      ) : null}

      <div className="action-zone">
        {canStart ? (
          <button
            type="button"
            className="action-start"
            onClick={() => {
              void props.onStart();
            }}
          >
            {startLabel}
          </button>
        ) : null}
        {isStarting ? (
          <button type="button" className="action-start" disabled>
            请求权限中…
          </button>
        ) : null}
        {micLive ? (
          <button
            type="button"
            className="action-stop"
            onClick={() => {
              setTunedIds(new Set());
              void props.onReset();
            }}
          >
            结束调音
          </button>
        ) : null}
        {!chromaticMode && tunedIds.size > 0 ? (
          <span className="tuned-count">
            已调 {tunedIds.size}/{targets.length}
          </span>
        ) : null}
      </div>

      {demo ? (
        <p className="tuned-count" style={{ textAlign: "center", paddingBottom: 12 }}>
          demo 模式:{demoKey} — 数据为固定夹具
        </p>
      ) : null}

      <footer>
        <DebugDrawer
          debugReadout={debugReadout}
          developerLogs={developerLogs}
          rawCandidate={rawCandidate}
          trackingState={trackingState}
          interpretation={interpretation}
          viewModel={viewModel}
        />
      </footer>
    </div>
  );
}
