import { useEffect, useRef, useState } from "react";
import {
  AutoCorrelationPitchDetector,
  BrowserMicrophoneManager,
  type MicrophoneSession,
  RollingPitchStabilizer,
  YinPitchDetector,
} from "../../../lib/audio";
import type { TunerEngineError, TunerState } from "../../../types";
import {
  createListeningState,
  createPermissionDeniedState,
  createTunerStateSnapshot,
  INITIAL_TUNER_STATE,
  resolveActiveTarget,
  resolveDeviation,
} from "./tunerState";

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
  const managerRef = useRef<BrowserMicrophoneManager | null>(null);
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

  if (!managerRef.current) {
    managerRef.current = new BrowserMicrophoneManager();
  }

  useEffect(() => {
    const manager = managerRef.current;

    return () => {
      stopProcessingLoop();
      if (manager) {
        void manager.dispose();
      }
    };
  }, []);

  function stopProcessingLoop() {
    if (loopHandleRef.current !== null) {
      window.clearInterval(loopHandleRef.current);
      loopHandleRef.current = null;
    }
  }

  function processAudioFrame(session: MicrophoneSession) {
    const detector = detectorRef.current;
    const comparisonDetector = comparisonDetectorRef.current;
    const stabilizer = stabilizerRef.current;
    const frame = session.frameCapture.readFrame(Date.now());
    const detectedPitch = detector.detect(frame.samples, frame.sampleRate, frame.timestampMs);
    const comparisonPitch = comparisonDetector.detect(frame.samples, frame.sampleRate, frame.timestampMs);
    const stabilizedPitch = stabilizer.push(detectedPitch);

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

    setState((previousState) => {
      const activeTarget = resolveActiveTarget(previousState.selection, detectedPitch, stabilizedPitch);
      const deviation = resolveDeviation(activeTarget, stabilizedPitch, detectedPitch);
      const uiStatus = !detectedPitch
        ? "listening"
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
    loopHandleRef.current = window.setInterval(() => {
      processAudioFrame(session);
    }, 75);
  }

  async function startTuning() {
    const manager = managerRef.current;

    if (!manager) {
      return;
    }

    setState(
      createTunerStateSnapshot({
        audioStatus: "requesting-permission",
        uiStatus: "requesting-permission",
        lastError: null,
      }),
    );

    try {
      const session = await manager.start();
      startProcessingLoop(session);
      setState(createListeningState());
    } catch (error) {
      stopProcessingLoop();
      const tunerError = toTunerEngineError(error);

      if (tunerError.code === "NotAllowedError") {
        setState(createPermissionDeniedState(tunerError));
        return;
      }

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

    setDetectorComparison(INITIAL_DETECTOR_COMPARISON_DEBUG);
    setState(INITIAL_TUNER_STATE);
  }

  return {
    state,
    detectorComparison,
    startTuning,
    resetSession,
    isStarting: state.uiStatus === "requesting-permission",
  };
}
