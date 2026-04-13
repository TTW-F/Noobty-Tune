import type { AudioEngineStatus, TunerEngineError } from "../../types/tuner";

export interface MicrophoneSession {
  readonly audioContext: AudioContext;
  readonly stream: MediaStream;
  readonly sourceNode: MediaStreamAudioSourceNode;
}

export interface MicrophoneManager {
  getStatus(): AudioEngineStatus;
  getSession(): MicrophoneSession | null;
  requestAccess(): Promise<MicrophoneSession>;
  start(): Promise<MicrophoneSession>;
  suspend(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
}

export class BrowserMicrophoneManager implements MicrophoneManager {
  private status: AudioEngineStatus = "idle";
  private session: MicrophoneSession | null = null;

  getStatus(): AudioEngineStatus {
    return this.status;
  }

  getSession(): MicrophoneSession | null {
    return this.session;
  }

  async requestAccess(): Promise<MicrophoneSession> {
    if (this.session) {
      return this.session;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.status = "error";
      throw toTunerEngineError(
        new DOMException("Media devices API is unavailable in this browser.", "NotSupportedError"),
      );
    }

    if (typeof AudioContext === "undefined") {
      this.status = "error";
      throw toTunerEngineError(
        new DOMException("AudioContext is unavailable in this browser.", "NotSupportedError"),
      );
    }

    this.status = "requesting-permission";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
        video: false,
      });

      this.status = "initializing-audio";

      const audioContext = new AudioContext();
      const sourceNode = audioContext.createMediaStreamSource(stream);

      this.session = {
        audioContext,
        stream,
        sourceNode,
      };
      this.status = audioContext.state === "running" ? "ready" : "suspended";

      return this.session;
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        this.status = "permission-denied";
      } else {
        this.status = "error";
      }

      throw toTunerEngineError(error);
    }
  }

  async start(): Promise<MicrophoneSession> {
    const session = await this.requestAccess();

    if (session.audioContext.state !== "running") {
      await session.audioContext.resume();
    }

    this.status = "listening";

    return session;
  }

  async suspend(): Promise<void> {
    if (!this.session) {
      this.status = "idle";
      return;
    }

    await this.session.audioContext.suspend();
    this.status = "suspended";
  }

  async resume(): Promise<void> {
    if (!this.session) {
      return;
    }

    await this.session.audioContext.resume();
    this.status = "listening";
  }

  async stop(): Promise<void> {
    await this.suspend();
  }

  async dispose(): Promise<void> {
    if (!this.session) {
      this.status = "idle";
      return;
    }

    this.session.stream.getTracks().forEach((track) => track.stop());
    await this.session.audioContext.close();
    this.session = null;
    this.status = "idle";
  }
}

function toTunerEngineError(error: unknown): TunerEngineError {
  if (error instanceof DOMException) {
    return {
      code: error.name,
      message: error.message || "Failed to access microphone.",
      recoverable: error.name !== "NotReadableError",
    };
  }

  if (error instanceof Error) {
    return {
      code: "audio-access-failed",
      message: error.message,
      recoverable: true,
    };
  }

  return {
    code: "audio-access-unknown",
    message: "Failed to access microphone.",
    recoverable: true,
  };
}
