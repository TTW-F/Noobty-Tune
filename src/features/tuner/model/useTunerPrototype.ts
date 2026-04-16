import { useEffect, useRef, useState } from "react";
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
  createDeviationFromCents,
  getClosestNoteMatch,
  getStandardTuningTarget,
  TuningInterpreter,
} from "../../../lib/music";
import type {
  PitchReading,
  StabilizedPitchReading,
  TunerEngineError,
  TunerState,
  TuningStringId,
  TuningTarget,
} from "../../../types";
import type {
  PitchTrackingState,
  RawPitchCandidate,
  TuningInterpretation,
  TunerViewModel,
} from "../../../types/pitchTracking";
import {
  DEFAULT_TUNER_SELECTION,
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
): TuningTarget | null {
  if (selection.mode === "manual" && selection.targetId) {
    return getStandardTuningTarget(selection.targetId);
  }

  if (!interpretation.targetId) {
    return null;
  }

  return getStandardTuningTarget(interpretation.targetId);
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

export function useTunerPrototype() {
  const managerRef = useRef(new BrowserMicrophoneManager());
  const detectorRef = useRef(
    new YinPitchDetector({
      algorithm: "yin",
      probabilityThreshold: 0.82,
      minFrequencyHz: 70,
      maxFrequencyHz: 360,
      rmsThreshold: 0.008,
    }),
  );
  const comparisonDetectorRef = useRef(
    new AutoCorrelationPitchDetector({
      algorithm: "autocorrelation",
      probabilityThreshold: 0.76,
      minFrequencyHz: 70,
      maxFrequencyHz: 360,
      rmsThreshold: 0.008,
    }),
  );
  const trackerRef = useRef(new ContinuousPitchTracker());
  const interpreterRef = useRef(new TuningInterpreter());
  const viewModelBuilderRef = useRef(new TunerViewModelBuilder());
  const loopHandleRef = useRef<number | null>(null);
  const selectionRef = useRef(INITIAL_TUNER_STATE.selection);
  const previousUiStatusRef = useRef<TunerState["uiStatus"]>(INITIAL_TUNER_STATE.uiStatus);

  const [state, setState] = useState<TunerState>(INITIAL_TUNER_STATE);
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
      const activeTarget = getTargetFromInterpretation(tuningInterpretation, previousState.selection);
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
    setDetectorComparison(INITIAL_DETECTOR_COMPARISON_DEBUG);
    setRawCandidate(null);
    setTrackingState(null);
    setInterpretation(null);
    setViewModel(createEmptyViewModel());
    setActiveInputLabel(session.inputDeviceLabel);
    loopHandleRef.current = window.setInterval(() => {
      processAudioFrame(session);
    }, 75);
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

    await manager.dispose();

    appLogger.info("Session reset", "Tuner session was reset and returned to idle.");
    setDetectorComparison(INITIAL_DETECTOR_COMPARISON_DEBUG);
    setRawCandidate(null);
    setTrackingState(null);
    setInterpretation(null);
    setViewModel(createEmptyViewModel());
    setActiveInputLabel(null);
    setState(INITIAL_TUNER_STATE);
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

  function enableAutoTargetMode() {
    appLogger.info("Target mode updated", "Switched tuning target mode to auto.");
    setState((previousState) =>
      createTunerStateSnapshot({
        ...previousState,
        selection: DEFAULT_TUNER_SELECTION,
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
          mode: "manual",
          targetId,
        },
      }),
    );
  }

  return {
    state,
    detectorComparison,
    availableInputs,
    selectedInputDeviceId,
    activeInputLabel,
    startTuning,
    resetSession,
    refreshInputDevices,
    selectInputDevice,
    enableAutoTargetMode,
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
