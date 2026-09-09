import { useMemo, useRef, useState } from "react";
import { STANDARD_GUITAR_TUNING } from "../../../lib/music";
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
import type { TunerState, TuningStringId } from "../../../types/tuner";
import { deriveFeedback } from "./feedback";
import { DebugDrawer } from "./DebugDrawer";
import { MicPopover } from "./MicPopover";
import { NoteStage } from "./NoteStage";
import { StatusLine } from "./StatusLine";
import { StringRail } from "./StringRail";
import { TunerMeter } from "./TunerMeter";
import { DEMO_SCENARIOS } from "./demo";

export type TunerScreenProps = {
  state: TunerState;
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
  onEnableAutoTargetMode: () => void;
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

  const feedback = deriveFeedback({
    state,
    viewModel,
    interpretation,
    trackingState,
    rawCandidate,
    frameRms,
    manualMode,
  });

  // 本会话已调好的弦(锁定 ±5 音分即标记)。
  // 渲染期条件更新(React 官方 "adjusting state on prop change" 模式),不用 effect。
  const [tunedIds, setTunedIds] = useState<ReadonlySet<TuningStringId>>(new Set());
  const tunedTargetId =
    feedback.tone === "true" && state.activeTarget ? state.activeTarget.id : null;
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
      STANDARD_GUITAR_TUNING.find((target) => target.note === note && target.octave === octave)?.id ??
      null
    );
  }, [state.stabilizedPitch, state.detectedPitch]);

  const level = Math.min(1, (frameRms ?? 0) / 0.03);
  const micLive = feedback.micLive;
  const canStart = !isStarting && !micLive && state.audioStatus !== "requesting-permission";
  const startLabel = isStarting
    ? "请求权限中…"
    : state.audioStatus === "permission-denied"
      ? "重新允许并开始"
      : "开始调音";

  return (
    <div className="app-frame">
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

      <div className="rail-zone">
        <StringRail
          activeTargetId={state.activeTarget?.id ?? null}
          selectionTargetId={state.selection.targetId}
          tunedIds={tunedIds}
          matchedTargetId={matchedTargetId}
          manualMode={manualMode}
          railHint={feedback.railHint}
          onSelectTarget={(id) => {
            props.onSelectManualTarget(id);
          }}
          onEnableAuto={props.onEnableAutoTargetMode}
          onEnterManual={() => {
            props.onSelectManualTarget(
              state.selection.targetId ?? state.activeTarget?.id ?? "string-6",
            );
          }}
        />
      </div>

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
        {tunedIds.size > 0 ? (
          <span className="tuned-count">
            已调 {tunedIds.size}/6
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
