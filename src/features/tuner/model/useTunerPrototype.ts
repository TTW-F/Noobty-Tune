import { useEffect, useRef, useState } from "react";
import {
  AutoCorrelationPitchDetector,
  type AudioInputDevice,
  BrowserMicrophoneManager,
  type MicrophoneSession,
  RollingPitchStabilizer,
  YinPitchDetector,
} from "../../../lib/audio";
import type { TunerEngineError, TunerState, TuningStringId } from "../../../types";
import {
  DEFAULT_TUNER_SELECTION,
  createListeningState,
  createPermissionDeniedState,
  createTunerStateSnapshot,
  getSelectedTarget,
  INITIAL_TUNER_STATE,
  resolveActiveTarget,
  resolveDeviation,
} from "./tunerState";
import { createScopedLogger } from "../../../lib/logging/developerLogger";

const appLogger = createScopedLogger("app");
const uiLogger = createScopedLogger("ui");
const frameLogger = createScopedLogger("frame");
const detectorLogger = createScopedLogger("detector");
const stabilizerLogger = createScopedLogger("stabilizer");
const SIGNAL_PRESENT_RMS = 0.003;
const SIGNAL_PRESENT_PEAK = 0.03;

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
  const stabilizerRef = useRef(
    new RollingPitchStabilizer({
      requiredSamples: 3,
      centsTolerance: 12,
      clarityThreshold: 0.82,
      maxHistory: 5,
    }),
  );
  const loopHandleRef = useRef<number | null>(null);
  const [state, setState] = useState<TunerState>(INITIAL_TUNER_STATE);
  const [detectorComparison, setDetectorComparison] = useState<DetectorComparisonDebug>(
    INITIAL_DETECTOR_COMPARISON_DEBUG,
  );
  const [availableInputs, setAvailableInputs] = useState<AudioInputDevice[]>([]);
  const [selectedInputDeviceId, setSelectedInputDeviceId] = useState<string | null>(null);
  const [activeInputLabel, setActiveInputLabel] = useState<string | null>(null);
  const previousUiStatusRef = useRef<TunerState["uiStatus"]>(INITIAL_TUNER_STATE.uiStatus);
  const selectionRef = useRef(INITIAL_TUNER_STATE.selection);

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
      if (manager) {
        void manager.dispose();
      }
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
    const stabilizer = stabilizerRef.current;
    const targetHint = getSelectedTarget(selectionRef.current);
    const frame = session.frameCapture.readFrame(Date.now());
    const detectedPitch = detector.detect(frame.samples, frame.sampleRate, frame.timestampMs);
    const comparisonPitch = comparisonDetector.detect(frame.samples, frame.sampleRate, frame.timestampMs);
    const stabilizedPitch = stabilizer.push(detectedPitch, targetHint);
    const signalPresent = frame.rms >= SIGNAL_PRESENT_RMS || frame.peak >= SIGNAL_PRESENT_PEAK;

    setDetectorComparison({
      frameRms: frame.rms,
      primaryAlgorithm: "yin",
      primaryFrequencyHz: detectedPitch?.frequencyHz ?? null,
      primaryClarity: detectedPitch?.clarity ?? null,
      primaryNoteLabel: toDebugNoteLabel(detectedPitch?.noteName, detectedPitch?.octave),
      secondaryAlgorithm: "autocorrelation",
      secondaryFrequencyHz: comparisonPitch?.frequencyHz ?? null,
      secondaryClarity: comparisonPitch?.clarity ?? null,
      secondaryNoteLabel: toDebugNoteLabel(comparisonPitch?.noteName, comparisonPitch?.octave),
      detectorDeltaHz:
        detectedPitch && comparisonPitch
          ? Math.abs(detectedPitch.frequencyHz - comparisonPitch.frequencyHz)
          : null,
    });

    frameLogger.debug("Frame summary", "Sampled microphone frame metrics for live diagnostics.", {
      throttleKey: "frame-summary",
      throttleMs: 900,
      meta: {
        rms: Number(frame.rms.toFixed(5)),
        peak: Number(frame.peak.toFixed(5)),
        sampleRate: frame.sampleRate,
        signalPresent,
      },
    });

    if (!detectedPitch && signalPresent) {
      detectorLogger.warn("Signal without pitch", "Audio energy is present, but no detector produced a valid pitch.", {
        throttleKey: "signal-without-pitch",
        throttleMs: 1200,
        meta: {
          rms: Number(frame.rms.toFixed(5)),
          peak: Number(frame.peak.toFixed(5)),
          yin: "null",
          autocorrelation: comparisonPitch ? Number(comparisonPitch.frequencyHz.toFixed(2)) : null,
        },
      });
    }

    if (detectedPitch) {
      detectorLogger.success("Primary detector hit", "YIN produced a candidate pitch.", {
        throttleKey: "primary-detector-hit",
        throttleMs: 700,
        meta: {
          frequencyHz: Number(detectedPitch.frequencyHz.toFixed(2)),
          clarity: Number(detectedPitch.clarity.toFixed(3)),
          note: toDebugNoteLabel(detectedPitch.noteName, detectedPitch.octave),
        },
      });
    }

    if (detectedPitch && comparisonPitch) {
      const deltaHz = Math.abs(detectedPitch.frequencyHz - comparisonPitch.frequencyHz);
      if (deltaHz >= 8) {
        detectorLogger.warn("Detector disagreement", "YIN and autocorrelation disagree beyond the diagnostic threshold.", {
          throttleKey: "detector-disagreement",
          throttleMs: 1200,
          meta: {
            yinHz: Number(detectedPitch.frequencyHz.toFixed(2)),
            autocorrelationHz: Number(comparisonPitch.frequencyHz.toFixed(2)),
            deltaHz: Number(deltaHz.toFixed(2)),
          },
        });
      }
    }

    if (stabilizedPitch?.stable) {
      stabilizerLogger.success("Stable pitch window", "Rolling stabilizer marked the current pitch window as stable.", {
        throttleKey: "stable-pitch-window",
        throttleMs: 1000,
        meta: {
          frequencyHz: Number(stabilizedPitch.frequencyHz.toFixed(2)),
          cents: Number(stabilizedPitch.cents?.toFixed(1) ?? 0),
          sampleCount: stabilizedPitch.sampleCount,
          target: stabilizedPitch.target?.id ?? "auto",
        },
      });
    }

    setState((previousState) => {
      const activeTarget = resolveActiveTarget(previousState.selection, detectedPitch, stabilizedPitch);
      const deviation = resolveDeviation(activeTarget, stabilizedPitch, detectedPitch);
      const uiStatus = !detectedPitch
        ? signalPresent
          ? "no-signal"
          : "listening"
        : stabilizedPitch?.stable
          ? deviation?.direction === "in-tune"
            ? "in-tune"
            : "detecting"
          : "unstable";

      return createTunerStateSnapshot({
        ...previousState,
        audioStatus: "listening",
        uiStatus,
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
    stabilizerRef.current.reset();
    setDetectorComparison(INITIAL_DETECTOR_COMPARISON_DEBUG);
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
    stabilizerRef.current.reset();

    if (manager) {
      await manager.dispose();
    }

    appLogger.info("Session reset", "Tuner session was reset and returned to idle.");
    setDetectorComparison(INITIAL_DETECTOR_COMPARISON_DEBUG);
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

    if (state.audioStatus === "listening" || state.audioStatus === "ready" || state.audioStatus === "suspended") {
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
  };
}
