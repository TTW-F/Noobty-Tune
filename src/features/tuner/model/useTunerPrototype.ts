import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AutoCorrelationPitchDetector,
  type AudioInputDevice,
  BrowserMicrophoneManager,
  ContinuousPitchTracker,
  extractPitchCandidate,
  globalDetectionLogger,
  type MicrophoneSession,
  YinPitchDetector,
} from "../../../lib/audio";
import { createScopedLogger } from "../../../lib/logging/developerLogger";
import { globalTimeSeriesLogger } from "../../../lib/logging/timeSeriesLogger";
import {
  CHROMATIC_NOTE_NAMES,
  DEFAULT_TUNING_ID,
  createCustomTuning,
  createDeviationFromCents,
  getClosestNoteMatch,
  getTuning,
  resolveTargets,
  TuningInterpreter,
} from "../../../lib/music";
import type {
  NoteName,
  PitchReading,
  StabilizedPitchReading,
  TunerEngineError,
  TunerSelection,
  TunerState,
  Tuning,
  TuningId,
  TuningStringId,
  TuningStringSpec,
  TuningTarget,
} from "../../../types";
import type {
  PitchTrackingState,
  RawPitchCandidate,
  TrackingStage,
  TuningInterpretation,
  TunerViewModel,
} from "../../../types/pitchTracking";
import {
  createListeningState,
  createPermissionDeniedState,
  createTunerStateSnapshot,
  INITIAL_TUNER_STATE,
} from "./tunerState";
import { createEmptyViewModel, TunerViewModelBuilder } from "./tunerViewModel";

const appLogger = createScopedLogger("app");
const uiLogger = createScopedLogger("ui");
const frameLogger = createScopedLogger("frame");
const detectorLogger = createScopedLogger("detector");
const stabilizerLogger = createScopedLogger("stabilizer");
const SIGNAL_PRESENT_RMS = 0.003;
const SIGNAL_PRESENT_PEAK = 0.03;
const SELECTION_STORAGE_KEY = "noobty-tuner:selection";
const CUSTOM_TUNINGS_STORAGE_KEY = "noobty-tuner:custom-tunings";

/**
 * 读取本地保存的自定义调弦。条目经完整校验,损坏项整条丢弃——
 * 自定义数据不允许带病运行。
 */
export function loadCustomTunings(): Tuning[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CUSTOM_TUNINGS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const tunings: Tuning[] = [];
    for (const item of parsed) {
      try {
        const tuning = reviveCustomTuning(item);
        tunings.push(tuning);
      } catch {
        // 跳过无法解析的条目
      }
    }
    return tunings;
  } catch {
    return [];
  }
}

function reviveCustomTuning(item: unknown): Tuning {
  if (typeof item !== "object" || item === null) {
    throw new Error("not an object");
  }
  const candidate = item as {
    id?: unknown;
    name?: unknown;
    strings?: unknown;
  };

  if (
    typeof candidate.id !== "string" ||
    !candidate.id.startsWith("custom:") ||
    typeof candidate.name !== "string" ||
    !candidate.name.trim() ||
    !Array.isArray(candidate.strings)
  ) {
    throw new Error("bad shape");
  }

  const strings: TuningStringSpec[] = candidate.strings.map((raw) => {
    if (typeof raw !== "object" || raw === null) {
      throw new Error("bad string");
    }
    const spec = raw as { number?: unknown; note?: unknown; octave?: unknown };
    const note = spec.note;
    if (
      !Number.isInteger(spec.number) ||
      typeof note !== "string" ||
      !CHROMATIC_NOTE_NAMES.includes(note as NoteName) ||
      !Number.isInteger(spec.octave)
    ) {
      throw new Error("bad string");
    }
    return { number: spec.number as number, note: note as NoteName, octave: spec.octave as number };
  });

  // 复用保存路径的全部校验(弦数边界/重复弦号/音域)
  const tuning = createCustomTuning(candidate.name, strings);
  return { ...tuning, id: candidate.id };
}

/**
 * 恢复上次的调弦与模式;调弦失效或数据损坏时回落默认(auto + 标准 E)。
 * manual 必须带有效目标才恢复——手动选弦没有目标是未定义状态,回落 auto。
 */
export function loadStoredSelection(
  resolveTuning: (id: TuningId) => Tuning | null = getTuning,
): TunerSelection {
  if (typeof window === "undefined") {
    return INITIAL_TUNER_STATE.selection;
  }

  try {
    const raw = window.localStorage.getItem(SELECTION_STORAGE_KEY);
    if (!raw) {
      return INITIAL_TUNER_STATE.selection;
    }

    const parsed = JSON.parse(raw) as Partial<TunerSelection>;
    const tuning = parsed.tuningId ? resolveTuning(parsed.tuningId) : null;
    if (!tuning) {
      return INITIAL_TUNER_STATE.selection;
    }

    const wantsManual = parsed.mode === "manual";
    const targetId =
      wantsManual &&
      typeof parsed.targetId === "string" &&
      resolveTargets(tuning).some((target) => target.id === parsed.targetId)
        ? parsed.targetId
        : null;

    if (parsed.mode !== "auto" && parsed.mode !== "manual" && parsed.mode !== "chromatic") {
      return INITIAL_TUNER_STATE.selection;
    }

    return {
      tuningId: tuning.id,
      mode: wantsManual && !targetId ? "auto" : parsed.mode,
      targetId,
    };
  } catch {
    return INITIAL_TUNER_STATE.selection;
  }
}

function mapViewModelStageToLegacyUiStatus(
  viewModel: TunerViewModel,
  candidate: RawPitchCandidate,
  signalPresent: boolean,
): TunerState["uiStatus"] {
  if (viewModel.showSuccess) {
    return "in-tune";
  }

  switch (viewModel.uiStage) {
    case "acquiring":
    case "tracking":
    case "locked":
      return "detecting";
    case "degraded":
      return "unstable";
    case "permission-denied":
      return "permission-denied";
    case "error":
      return "error";
    case "idle":
    case "lost":
    default:
      if (signalPresent && candidate.frequencyHz === null) {
        return candidate.rms < SIGNAL_PRESENT_RMS * 1.5 ? "signal-weak" : "no-signal";
      }
      return "listening";
  }
}

function toTunerEngineError(error: unknown): TunerEngineError {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    "message" in error &&
    "recoverable" in error
  ) {
    return error as TunerEngineError;
  }

  if (error instanceof Error) {
    return {
      code: "unknown-error",
      message: error.message,
      recoverable: true,
    };
  }

  return {
    code: "unknown-error",
    message: "An unknown audio error occurred. Please refresh and try again.",
    recoverable: true,
  };
}

function toDebugNoteLabel(noteName?: string, octave?: number) {
  if (!noteName || typeof octave !== "number") {
    return null;
  }

  return `${noteName}${octave}`;
}

function getTargetFromInterpretation(
  interpretation: TuningInterpretation,
  selection: TunerState["selection"],
  targets: readonly TuningTarget[],
): TuningTarget | null {
  const wantedId =
    selection.mode === "manual" && selection.targetId
      ? selection.targetId
      : interpretation.targetId;

  if (!wantedId) {
    return null;
  }

  return targets.find((target) => target.id === wantedId) ?? null;
}

function toPitchReading(candidate: RawPitchCandidate): PitchReading | null {
  if (candidate.frequencyHz === null) {
    return null;
  }

  const noteMatch = getClosestNoteMatch(candidate.frequencyHz);

  return {
    frequencyHz: candidate.frequencyHz,
    clarity: candidate.clarity,
    timestampMs: candidate.timestampMs,
    source: "microphone",
    rms: candidate.rms,
    noteName: noteMatch?.note,
    octave: noteMatch?.octave,
    cents: noteMatch?.cents,
  };
}

function toTrackedReading(
  trackingState: PitchTrackingState,
  interpretation: TuningInterpretation,
  activeTarget: TuningTarget | null,
): StabilizedPitchReading | null {
  if (trackingState.trackedFrequencyHz === null) {
    return null;
  }

  const noteMatch = getClosestNoteMatch(trackingState.trackedFrequencyHz);
  return {
    frequencyHz: trackingState.trackedFrequencyHz,
    clarity: trackingState.confidence,
    timestampMs: trackingState.timestampMs,
    source: "microphone",
    noteName: noteMatch?.note,
    octave: noteMatch?.octave,
    cents: interpretation.centsOffset ?? noteMatch?.cents,
    stable: trackingState.stage === "locked",
    sampleCount: trackingState.stage === "locked" ? 3 : 1,
    target: activeTarget,
  };
}

export type DetectorComparisonDebug = {
  readonly frameRms: number | null;
  readonly primaryAlgorithm: "yin";
  readonly primaryFrequencyHz: number | null;
  readonly primaryClarity: number | null;
  readonly primaryNoteLabel: string | null;
  readonly secondaryAlgorithm: "autocorrelation";
  readonly secondaryFrequencyHz: number | null;
  readonly secondaryClarity: number | null;
  readonly secondaryNoteLabel: string | null;
  readonly detectorDeltaHz: number | null;
};

const INITIAL_DETECTOR_COMPARISON_DEBUG: DetectorComparisonDebug = {
  frameRms: null,
  primaryAlgorithm: "yin",
  primaryFrequencyHz: null,
  primaryClarity: null,
  primaryNoteLabel: null,
  secondaryAlgorithm: "autocorrelation",
  secondaryFrequencyHz: null,
  secondaryClarity: null,
  secondaryNoteLabel: null,
  detectorDeltaHz: null,
};

/**
 * 每帧原始采样的可变快照,供 60fps 画布(振动弦等)直接读取,
 * 不经过 React 状态,避免 13Hz 的帧循环拖慢动画。
 */
export type LiveAudioSample = {
  readonly timestampMs: number;
  readonly rms: number;
  readonly peak: number;
  readonly frequencyHz: number | null;
  readonly trackedFrequencyHz: number | null;
  readonly confidence: number;
  readonly stage: TrackingStage;
  readonly centsOffset: number | null;
};

export const EMPTY_LIVE_SAMPLE: LiveAudioSample = {
  timestampMs: 0,
  rms: 0,
  peak: 0,
  frequencyHz: null,
  trackedFrequencyHz: null,
  confidence: 0,
  stage: "idle",
  centsOffset: null,
};

export function useTunerPrototype() {
  const managerRef = useRef(new BrowserMicrophoneManager());
  const detectorRef = useRef(
    new YinPitchDetector({
      algorithm: "yin",
      // Search sensitivity only: the detector reports marginal frames with
      // their honest clarity instead of dropping them, and the tracker's
      // lock/hold thresholds decide how each clarity band is used.
      probabilityThreshold: 0.82,
      clarityFloor: 0.35,
      // 55 Hz 覆盖 7 弦吉他的 B1(61.7 Hz);真机低音弦质量仍属 ADR 0006 M4 验收项
      minFrequencyHz: 55,
      maxFrequencyHz: 360,
      rmsThreshold: 0.008,
    }),
  );
  const comparisonDetectorRef = useRef(
    new AutoCorrelationPitchDetector({
      algorithm: "autocorrelation",
      probabilityThreshold: 0.76,
      clarityFloor: 0.35,
      minFrequencyHz: 55,
      maxFrequencyHz: 360,
      rmsThreshold: 0.008,
    }),
  );
  const trackerRef = useRef(new ContinuousPitchTracker());
  const viewModelBuilderRef = useRef(new TunerViewModelBuilder());
  const loopHandleRef = useRef<number | null>(null);
  const previousUiStatusRef = useRef<TunerState["uiStatus"]>(INITIAL_TUNER_STATE.uiStatus);

  const initialCustomTunings = useMemo(() => loadCustomTunings(), []);
  const [customTunings, setCustomTunings] = useState<Tuning[]>(initialCustomTunings);

  // 内置目录 + 本地自定义注册表 = 完整的调弦解析器
  const getTuningById = useCallback(
    (id: TuningId): Tuning | null =>
      getTuning(id) ?? customTunings.find((tuning) => tuning.id === id) ?? null,
    [customTunings],
  );

  const initialSelection = useMemo(
    () => loadStoredSelection((id) => getTuning(id) ?? initialCustomTunings.find((tuning) => tuning.id === id) ?? null),
    [initialCustomTunings],
  );
  const selectionRef = useRef(initialSelection);

  const [state, setState] = useState<TunerState>(() => ({
    ...INITIAL_TUNER_STATE,
    selection: initialSelection,
  }));

  // 当前调弦 → 目标频率列表。解释器和 UI 都只消费这份解析结果。
  const targets = useMemo(
    () =>
      resolveTargets(
        getTuning(state.selection.tuningId) ??
          customTunings.find((tuning) => tuning.id === state.selection.tuningId) ??
          getTuning(DEFAULT_TUNING_ID)!,
      ),
    [state.selection.tuningId, customTunings],
  );
  const targetsRef = useRef(targets);
  const interpreterRef = useRef(new TuningInterpreter(targets));
  const [detectorComparison, setDetectorComparison] = useState<DetectorComparisonDebug>(
    INITIAL_DETECTOR_COMPARISON_DEBUG,
  );
  const [availableInputs, setAvailableInputs] = useState<AudioInputDevice[]>([]);
  const [selectedInputDeviceId, setSelectedInputDeviceId] = useState<string | null>(null);
  const [activeInputLabel, setActiveInputLabel] = useState<string | null>(null);
  const [rawCandidate, setRawCandidate] = useState<RawPitchCandidate | null>(null);
  const [trackingState, setTrackingState] = useState<PitchTrackingState | null>(null);
  const [interpretation, setInterpretation] = useState<TuningInterpretation | null>(null);
  const [viewModel, setViewModel] = useState<TunerViewModel>(createEmptyViewModel());
  const liveRef = useRef<LiveAudioSample>(EMPTY_LIVE_SAMPLE);

  function stopProcessingLoop() {
    if (loopHandleRef.current !== null) {
      window.clearInterval(loopHandleRef.current);
      loopHandleRef.current = null;
    }
  }

  async function refreshInputDevices() {
    const manager = managerRef.current;
    const devices = await manager.listInputDevices();
    setAvailableInputs(devices);

    const preferredDeviceId = manager.getPreferredInputDeviceId();
    if (preferredDeviceId) {
      setSelectedInputDeviceId(preferredDeviceId);
      return devices;
    }

    const session = manager.getSession();
    if (session?.inputDeviceId) {
      setSelectedInputDeviceId(session.inputDeviceId);
      return devices;
    }

    setSelectedInputDeviceId(devices[0]?.deviceId ?? null);
    return devices;
  }

  useEffect(() => {
    const manager = managerRef.current;
    void refreshInputDevices();

    return () => {
      stopProcessingLoop();
      void manager.dispose();
    };
  }, []);

  useEffect(() => {
    if (previousUiStatusRef.current === state.uiStatus) {
      return;
    }

    uiLogger.info("UI state changed", "Tuner UI status transitioned.", {
      meta: {
        from: previousUiStatusRef.current,
        to: state.uiStatus,
      },
    });
    previousUiStatusRef.current = state.uiStatus;
  }, [state.uiStatus]);

  useEffect(() => {
    selectionRef.current = state.selection;
  }, [state.selection]);

  // 记住用户的调弦与模式选择,刷新后恢复
  useEffect(() => {
    try {
      window.localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(state.selection));
    } catch {
      // 隐私模式等场景下持久化失败可忽略,不影响功能
    }
  }, [state.selection]);

  // 自定义调弦注册表持久化
  useEffect(() => {
    try {
      window.localStorage.setItem(CUSTOM_TUNINGS_STORAGE_KEY, JSON.stringify(customTunings));
    } catch {
      // 同上,持久化失败不影响本会话使用
    }
  }, [customTunings]);

  // 换调弦时同步目标集;setTargets 会清空解释器的迟滞状态(新调弦没有"上一根弦")。
  useEffect(() => {
    targetsRef.current = targets;
    interpreterRef.current.setTargets(targets);
  }, [targets]);

  function processAudioFrame(session: MicrophoneSession) {
    const detector = detectorRef.current;
    const comparisonDetector = comparisonDetectorRef.current;
    const tracker = trackerRef.current;
    const interpreter = interpreterRef.current;
    const viewModelBuilder = viewModelBuilderRef.current;
    const frame = session.frameCapture.readFrame(Date.now());

    const candidate = extractPitchCandidate(
      detector,
      frame.samples,
      frame.sampleRate,
      frame.timestampMs,
      "yin",
    );
    const comparisonCandidate = extractPitchCandidate(
      comparisonDetector,
      frame.samples,
      frame.sampleRate,
      frame.timestampMs,
      "autocorrelation",
    );
    const tracked = tracker.update(candidate);
    const tuningInterpretation = interpreter.interpret(tracked, selectionRef.current);
    const vm = viewModelBuilder.build(tuningInterpretation);
    const signalPresent = frame.rms >= SIGNAL_PRESENT_RMS || frame.peak >= SIGNAL_PRESENT_PEAK;
    const detectedPitch = toPitchReading(candidate);
    const comparisonPitch = toPitchReading(comparisonCandidate);

    liveRef.current = {
      timestampMs: frame.timestampMs,
      rms: frame.rms,
      peak: frame.peak,
      frequencyHz: candidate.frequencyHz,
      trackedFrequencyHz: tracked.trackedFrequencyHz,
      confidence: tracked.confidence,
      stage: tracked.stage,
      centsOffset: tuningInterpretation.centsOffset,
    };

    setRawCandidate(candidate);
    setTrackingState(tracked);
    setInterpretation(tuningInterpretation);
    setViewModel(vm);

    setDetectorComparison({
      frameRms: frame.rms,
      primaryAlgorithm: "yin",
      primaryFrequencyHz: candidate.frequencyHz,
      primaryClarity: candidate.clarity,
      primaryNoteLabel: toDebugNoteLabel(detectedPitch?.noteName, detectedPitch?.octave),
      secondaryAlgorithm: "autocorrelation",
      secondaryFrequencyHz: comparisonCandidate.frequencyHz,
      secondaryClarity: comparisonCandidate.clarity,
      secondaryNoteLabel: toDebugNoteLabel(comparisonPitch?.noteName, comparisonPitch?.octave),
      detectorDeltaHz:
        candidate.frequencyHz && comparisonCandidate.frequencyHz
          ? Math.abs(candidate.frequencyHz - comparisonCandidate.frequencyHz)
          : null,
    });

    globalDetectionLogger.log({
      timestampMs: frame.timestampMs,
      frameRms: frame.rms,
      framePeak: frame.peak,
      detectedFrequencyHz: candidate.frequencyHz,
      detectedClarity: candidate.clarity,
      comparisonFrequencyHz: comparisonCandidate.frequencyHz,
      stabilizedFrequencyHz: tracked.trackedFrequencyHz,
      stabilizedStable: tracked.stage === "locked",
      uiStatus: vm.uiStage,
      note: tuningInterpretation.detectedNote ?? vm.displayFrequency,
    });

    globalTimeSeriesLogger.log(
      candidate,
      tracked,
      tuningInterpretation,
      vm,
      frame.rms,
      frame.peak,
    );

    frameLogger.debug("Frame summary", "Sampled microphone frame metrics for live diagnostics.", {
      throttleKey: "frame-summary",
      throttleMs: 900,
      meta: {
        rms: Number(frame.rms.toFixed(5)),
        peak: Number(frame.peak.toFixed(5)),
        sampleRate: frame.sampleRate,
        signalPresent,
        trackingStage: tracked.stage,
        confidence: Number(tracked.confidence.toFixed(3)),
      },
    });

    if (!candidate.frequencyHz && signalPresent) {
      detectorLogger.warn(
        "Signal without pitch",
        "Audio energy is present, but no detector produced a valid pitch.",
        {
          throttleKey: "signal-without-pitch",
          throttleMs: 1200,
          meta: {
            rms: Number(frame.rms.toFixed(5)),
            peak: Number(frame.peak.toFixed(5)),
            yin: "null",
            autocorrelation: comparisonCandidate.frequencyHz
              ? Number(comparisonCandidate.frequencyHz.toFixed(2))
              : null,
          },
        },
      );
    }

    if (candidate.frequencyHz) {
      detectorLogger.success("Primary detector hit", "YIN produced a candidate pitch.", {
        throttleKey: "primary-detector-hit",
        throttleMs: 700,
        meta: {
          frequencyHz: Number(candidate.frequencyHz.toFixed(2)),
          clarity: Number(candidate.clarity.toFixed(3)),
          trackingStage: tracked.stage,
        },
      });
    }

    if (candidate.frequencyHz && comparisonCandidate.frequencyHz) {
      const deltaHz = Math.abs(candidate.frequencyHz - comparisonCandidate.frequencyHz);
      if (deltaHz >= 8) {
        detectorLogger.warn(
          "Detector disagreement",
          "YIN and autocorrelation disagree beyond the diagnostic threshold.",
          {
            throttleKey: "detector-disagreement",
            throttleMs: 1200,
            meta: {
              yinHz: Number(candidate.frequencyHz.toFixed(2)),
              autocorrelationHz: Number(comparisonCandidate.frequencyHz.toFixed(2)),
              deltaHz: Number(deltaHz.toFixed(2)),
            },
          },
        );
      }
    }

    if (tracked.stage === "locked") {
      stabilizerLogger.success("Stable pitch window", "Pitch tracker marked the current window as locked.", {
        throttleKey: "stable-pitch-window",
        throttleMs: 1000,
        meta: {
          frequencyHz: Number((tracked.trackedFrequencyHz ?? 0).toFixed(2)),
          cents: Number((tuningInterpretation.centsOffset ?? 0).toFixed(1)),
          target: tuningInterpretation.targetId ?? "auto",
          confidence: Number(tracked.confidence.toFixed(3)),
        },
      });
    }

    setState((previousState) => {
      const activeTarget = getTargetFromInterpretation(
        tuningInterpretation,
        previousState.selection,
        targetsRef.current,
      );
      const stabilizedPitch = toTrackedReading(tracked, tuningInterpretation, activeTarget);
      const deviation =
        activeTarget && tuningInterpretation.centsOffset !== null
          ? createDeviationFromCents(tuningInterpretation.centsOffset)
          : null;

      return createTunerStateSnapshot({
        ...previousState,
        audioStatus: "listening",
        uiStatus: mapViewModelStageToLegacyUiStatus(vm, candidate, signalPresent),
        activeTarget,
        detectedPitch,
        stabilizedPitch,
        deviation,
        lastError: null,
      });
    });
  }

  function startProcessingLoop(session: MicrophoneSession) {
    stopProcessingLoop();
    detectorRef.current.reset?.();
    comparisonDetectorRef.current.reset?.();
    trackerRef.current.reset();
    interpreterRef.current.reset();
    viewModelBuilderRef.current.reset();
    liveRef.current = EMPTY_LIVE_SAMPLE;
    setDetectorComparison(INITIAL_DETECTOR_COMPARISON_DEBUG);
    setRawCandidate(null);
    setTrackingState(null);
    setInterpretation(null);
    setViewModel(createEmptyViewModel());
    setActiveInputLabel(session.inputDeviceLabel);
    loopHandleRef.current = window.setInterval(() => {
      processAudioFrame(session);
    }, 50);
  }

  async function startWithCurrentInput() {
    const manager = managerRef.current;
    const session = await manager.start();
    await refreshInputDevices();
    startProcessingLoop(session);
    setState(createListeningState());
    appLogger.success("Tuner listening", "Tuner entered the active listening loop.", {
      meta: {
        sampleRate: session.audioContext.sampleRate,
        audioState: session.audioContext.state,
        inputDevice: session.inputDeviceLabel ?? "unknown",
      },
    });
  }

  async function startTuning() {
    setState(
      createTunerStateSnapshot({
        audioStatus: "requesting-permission",
        uiStatus: "requesting-permission",
        lastError: null,
      }),
    );
    appLogger.info("Start tuning", "User requested the tuner session to start.");

    try {
      await startWithCurrentInput();
    } catch (error) {
      stopProcessingLoop();
      const tunerError = toTunerEngineError(error);

      if (tunerError.code === "NotAllowedError") {
        appLogger.error("Permission denied", "User denied microphone permission.", {
          meta: {
            code: tunerError.code,
          },
        });
        setState(createPermissionDeniedState(tunerError));
        return;
      }

      appLogger.error("Start failed", "Tuner failed to start listening.", {
        meta: {
          code: tunerError.code,
        },
      });
      setState(
        createTunerStateSnapshot({
          audioStatus: "error",
          uiStatus: "error",
          lastError: tunerError,
        }),
      );
    }
  }

  async function resetSession() {
    const manager = managerRef.current;
    stopProcessingLoop();
    detectorRef.current.reset?.();
    comparisonDetectorRef.current.reset?.();
    trackerRef.current.reset();
    interpreterRef.current.reset();
    viewModelBuilderRef.current.reset();
    liveRef.current = EMPTY_LIVE_SAMPLE;

    await manager.dispose();

    appLogger.info("Session reset", "Tuner session was reset and returned to idle.");
    setDetectorComparison(INITIAL_DETECTOR_COMPARISON_DEBUG);
    setRawCandidate(null);
    setTrackingState(null);
    setInterpretation(null);
    setViewModel(createEmptyViewModel());
    setActiveInputLabel(null);
    // 保留用户选中的调弦与模式,只结束本次调音会话
    setState((current) =>
      createTunerStateSnapshot({ ...INITIAL_TUNER_STATE, selection: current.selection }),
    );
  }

  async function selectInputDevice(deviceId: string) {
    const manager = managerRef.current;
    manager.setPreferredInputDevice(deviceId);
    setSelectedInputDeviceId(deviceId);

    const matchingDevice = availableInputs.find((device) => device.deviceId === deviceId);
    appLogger.info("Input device selected", "User selected a microphone input device.", {
      meta: {
        deviceId,
        label: matchingDevice?.label ?? "unknown",
      },
    });

    if (
      state.audioStatus === "listening" ||
      state.audioStatus === "ready" ||
      state.audioStatus === "suspended"
    ) {
      stopProcessingLoop();
      await manager.dispose();
      setActiveInputLabel(null);
      setState(
        createTunerStateSnapshot({
          audioStatus: "requesting-permission",
          uiStatus: "requesting-permission",
          lastError: null,
        }),
      );

      try {
        await startWithCurrentInput();
      } catch (error) {
        const tunerError = toTunerEngineError(error);
        setState(
          createTunerStateSnapshot({
            audioStatus: "error",
            uiStatus: "error",
            lastError: tunerError,
          }),
        );
      }
      return;
    }

    await refreshInputDevices();
  }

  function selectTuning(tuningId: TuningId) {
    const tuning = getTuningById(tuningId);
    if (!tuning) {
      return;
    }

    appLogger.info("Tuning changed", `Switched tuning to ${tuning.name}.`, {
      meta: { tuningId: tuning.id },
    });
    // 换调弦回到自动模式:手动选中的弦在新区间里未必还有意义,
    // 目标集替换由 targets effect 下发并清空解释器迟滞。
    setState((previousState) =>
      createTunerStateSnapshot({
        ...previousState,
        selection: { tuningId: tuning.id, mode: "auto", targetId: null },
      }),
    );
  }

  function saveCustomTuning(strings: readonly TuningStringSpec[], name: string) {
    const tuning = createCustomTuning(name, strings);
    setCustomTunings((previous) => [...previous, tuning]);
    appLogger.info("Custom tuning saved", `Saved custom tuning ${tuning.name}.`, {
      meta: { tuningId: tuning.id, strings: tuning.strings.length },
    });
    setState((previousState) =>
      createTunerStateSnapshot({
        ...previousState,
        selection: { tuningId: tuning.id, mode: "auto", targetId: null },
      }),
    );
  }

  function deleteCustomTuning(tuningId: TuningId) {
    const tuning = customTunings.find((item) => item.id === tuningId);
    if (!tuning) {
      return;
    }

    appLogger.info("Custom tuning deleted", `Deleted custom tuning ${tuning.name}.`, {
      meta: { tuningId },
    });
    setCustomTunings((previous) => previous.filter((item) => item.id !== tuningId));

    // 删除的是当前激活的调弦 → 回落标准 E
    setState((previousState) =>
      previousState.selection.tuningId === tuningId
        ? createTunerStateSnapshot({
            ...previousState,
            selection: { tuningId: DEFAULT_TUNING_ID, mode: "auto", targetId: null },
          })
        : previousState,
    );
  }

  function enableChromaticMode() {
    appLogger.info("Target mode updated", "Switched target mode to chromatic.");
    setState((previousState) =>
      createTunerStateSnapshot({
        ...previousState,
        selection: { ...previousState.selection, mode: "chromatic" },
      }),
    );
  }

  function enableAutoTargetMode() {
    appLogger.info("Target mode updated", "Switched tuning target mode to auto.");
    setState((previousState) =>
      createTunerStateSnapshot({
        ...previousState,
        selection: {
          ...previousState.selection,
          mode: "auto",
          targetId: null,
        },
      }),
    );
  }

  function selectManualTarget(targetId: TuningStringId) {
    appLogger.info("Target mode updated", "Switched tuning target mode to manual.", {
      meta: {
        targetId,
      },
    });
    setState((previousState) =>
      createTunerStateSnapshot({
        ...previousState,
        selection: {
          ...previousState.selection,
          mode: "manual",
          targetId,
        },
      }),
    );
  }

  return {
    state,
    targets,
    customTunings,
    detectorComparison,
    availableInputs,
    selectedInputDeviceId,
    activeInputLabel,
    liveRef,
    startTuning,
    resetSession,
    refreshInputDevices,
    selectInputDevice,
    selectTuning,
    saveCustomTuning,
    deleteCustomTuning,
    enableAutoTargetMode,
    enableChromaticMode,
    selectManualTarget,
    isStarting: state.uiStatus === "requesting-permission",
    rawCandidate,
    trackingState,
    interpretation,
    viewModel,
    debugLogger: {
      start: () => globalDetectionLogger.startRecording(),
      stop: () => globalDetectionLogger.stopRecording(),
      export: () => globalDetectionLogger.exportToConsole(),
      analyze: () => globalDetectionLogger.analyzeDropoutPoint(),
      exportCSV: () => globalDetectionLogger.exportToCSV(),
    },
    timeSeriesLogger: {
      start: () => globalTimeSeriesLogger.startRecording(),
      stop: () => globalTimeSeriesLogger.stopRecording(),
      export: () => globalTimeSeriesLogger.exportToConsole(),
      downloadCSV: () => globalTimeSeriesLogger.downloadCSV(),
      analyzeTransitions: () => globalTimeSeriesLogger.analyzeStateTransitions(),
      analyzeMismatches: () => globalTimeSeriesLogger.analyzeMismatchPoints(),
      analyzeLockDuration: () => globalTimeSeriesLogger.analyzeLockDuration(),
      generateReport: () => globalTimeSeriesLogger.generateReport(),
      clear: () => globalTimeSeriesLogger.clear(),
    },
  };
}
