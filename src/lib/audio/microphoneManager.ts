import type { AudioEngineStatus, TunerEngineError } from "../../types/tuner";
import { createScopedLogger } from "../logging/developerLogger";
import { AnalyserTimeDomainFrameCapture, type TimeDomainFrameCapture } from "./frameCapture";

const audioLogger = createScopedLogger("audio");
const permissionLogger = createScopedLogger("permission");

export interface MicrophoneSession {
  readonly audioContext: AudioContext;
  readonly stream: MediaStream;
  readonly sourceNode: MediaStreamAudioSourceNode;
  readonly frameCapture: TimeDomainFrameCapture;
  readonly inputDeviceId: string | null;
  readonly inputDeviceLabel: string | null;
}

export interface AudioInputDevice {
  readonly deviceId: string;
  readonly label: string;
}

export interface MicrophoneManager {
  getStatus(): AudioEngineStatus;
  getSession(): MicrophoneSession | null;
  getPreferredInputDeviceId(): string | null;
  setPreferredInputDevice(deviceId: string | null): void;
  listInputDevices(): Promise<AudioInputDevice[]>;
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
  private preferredInputDeviceId: string | null = null;

  getStatus(): AudioEngineStatus {
    return this.status;
  }

  getSession(): MicrophoneSession | null {
    return this.session;
  }

  getPreferredInputDeviceId(): string | null {
    return this.preferredInputDeviceId;
  }

  setPreferredInputDevice(deviceId: string | null): void {
    this.preferredInputDeviceId = deviceId;
    audioLogger.info("Preferred input updated", "Updated the preferred microphone input.", {
      meta: {
        deviceId: deviceId ?? "default",
      },
    });
  }

  async listInputDevices(): Promise<AudioInputDevice[]> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      permissionLogger.warn("Enumerate devices unavailable", "This browser does not support device enumeration.");
      return [];
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices
      .filter((device) => device.kind === "audioinput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${index + 1}`,
      }));

    audioLogger.debug("Input devices listed", "Enumerated available audio input devices.", {
      meta: {
        count: audioInputs.length,
      },
    });

    return audioInputs;
  }

  async requestAccess(): Promise<MicrophoneSession> {
    if (this.session) {
      audioLogger.debug("Reuse session", "Reusing the existing microphone session.", {
        meta: {
          status: this.status,
        },
      });
      return this.session;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.status = "error";
      permissionLogger.error("MediaDevices unavailable", "The browser does not expose getUserMedia.", {
        meta: {
          status: this.status,
        },
      });
      throw toTunerEngineError(
        new DOMException("Media devices API is unavailable in this browser.", "NotSupportedError"),
      );
    }

    if (typeof AudioContext === "undefined") {
      this.status = "error";
      audioLogger.error("AudioContext unavailable", "The browser does not support AudioContext.", {
        meta: {
          status: this.status,
        },
      });
      throw toTunerEngineError(
        new DOMException("AudioContext is unavailable in this browser.", "NotSupportedError"),
      );
    }

    this.status = "requesting-permission";
    permissionLogger.info("Permission request", "Requesting microphone access after user interaction.", {
      meta: {
        status: this.status,
      },
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: this.preferredInputDeviceId ? { exact: this.preferredInputDeviceId } : undefined,
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
        video: false,
      });

      this.status = "initializing-audio";
      permissionLogger.success("Permission granted", "Microphone access was granted by the browser.");

      const audioContext = new AudioContext();
      const sourceNode = audioContext.createMediaStreamSource(stream);
      const frameCapture = new AnalyserTimeDomainFrameCapture(sourceNode);
      const track = stream.getAudioTracks()[0] ?? null;
      const settings = track?.getSettings();
      const inputDeviceId = settings?.deviceId ?? this.preferredInputDeviceId ?? null;
      const deviceLabel = track?.label || null;

      this.session = {
        audioContext,
        stream,
        sourceNode,
        frameCapture,
        inputDeviceId,
        inputDeviceLabel: deviceLabel,
      };
      this.status = audioContext.state === "running" ? "ready" : "suspended";
      audioLogger.success("Session initialized", "Microphone stream and analyser pipeline are ready.", {
        meta: {
          sampleRate: audioContext.sampleRate,
          audioState: audioContext.state,
          trackCount: stream.getTracks().length,
          inputDeviceId: inputDeviceId ?? "default",
          inputDeviceLabel: deviceLabel ?? "unknown",
          status: this.status,
        },
      });

      return this.session;
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        this.status = "permission-denied";
      } else {
        this.status = "error";
      }

      permissionLogger.error("Permission or device failure", "Failed to create the microphone session.", {
        meta: {
          code: error instanceof DOMException ? error.name : "unknown-error",
          status: this.status,
        },
      });

      throw toTunerEngineError(error);
    }
  }

  async start(): Promise<MicrophoneSession> {
    const session = await this.requestAccess();

    if (session.audioContext.state !== "running") {
      await session.audioContext.resume();
    }

    this.status = "listening";
    audioLogger.success("Audio started", "AudioContext is running and the tuner is listening.", {
      meta: {
        audioState: session.audioContext.state,
        sampleRate: session.audioContext.sampleRate,
        status: this.status,
      },
    });

    return session;
  }

  async suspend(): Promise<void> {
    if (!this.session) {
      this.status = "idle";
      return;
    }

    await this.session.audioContext.suspend();
    this.status = "suspended";
    audioLogger.warn("Audio suspended", "AudioContext was suspended for the current session.", {
      meta: {
        status: this.status,
      },
    });
  }

  async resume(): Promise<void> {
    if (!this.session) {
      return;
    }

    await this.session.audioContext.resume();
    this.status = "listening";
    audioLogger.info("Audio resumed", "AudioContext resumed listening.", {
      meta: {
        audioState: this.session.audioContext.state,
        status: this.status,
      },
    });
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
    this.session.frameCapture.dispose();
    await this.session.audioContext.close();
    this.session = null;
    this.status = "idle";
    audioLogger.info("Session disposed", "Microphone stream and audio context were released.", {
      meta: {
        status: this.status,
      },
    });
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
