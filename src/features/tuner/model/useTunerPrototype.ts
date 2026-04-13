import { useEffect, useRef, useState } from "react";
import {
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
    const stabilizer = stabilizerRef.current;
    const frame = session.frameCapture.readFrame(Date.now());
    const detectedPitch = detector.detect(frame.samples, frame.sampleRate, frame.timestampMs);
    const stabilizedPitch = stabilizer.push(detectedPitch);

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
    stabilizerRef.current.reset();
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
    stabilizerRef.current.reset();

    if (manager) {
      await manager.dispose();
    }

    setState(INITIAL_TUNER_STATE);
  }

  return {
    state,
    startTuning,
    resetSession,
    isStarting: state.uiStatus === "requesting-permission",
  };
}
