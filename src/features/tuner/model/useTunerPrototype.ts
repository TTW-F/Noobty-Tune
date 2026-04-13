import { useEffect, useRef, useState } from "react";
import { BrowserMicrophoneManager } from "../../../lib/audio";
import {
  createListeningState,
  createPermissionDeniedState,
  createTunerStateSnapshot,
  INITIAL_TUNER_STATE,
} from "./tunerState";
import type { TunerEngineError, TunerState } from "../../../types";

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
    message: "发生了未知错误，请刷新后重试。",
    recoverable: true,
  };
}

export function useTunerPrototype() {
  const managerRef = useRef<BrowserMicrophoneManager | null>(null);
  const [state, setState] = useState<TunerState>(INITIAL_TUNER_STATE);

  if (!managerRef.current) {
    managerRef.current = new BrowserMicrophoneManager();
  }

  useEffect(() => {
    const manager = managerRef.current;

    return () => {
      if (manager) {
        void manager.dispose();
      }
    };
  }, []);

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
      await manager.start();
      setState(createListeningState());
    } catch (error) {
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
