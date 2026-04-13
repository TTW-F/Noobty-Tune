import type { PitchDetector, PitchReading } from "../../types/tuner";

export interface PitchDetectorOptions {
  readonly algorithm: "yin" | "autocorrelation" | "placeholder";
  readonly clarityThreshold?: number;
}

export class PlaceholderPitchDetector implements PitchDetector {
  private readonly options: PitchDetectorOptions;

  constructor(options: PitchDetectorOptions = { algorithm: "placeholder" }) {
    this.options = options;
  }

  detect(input: Float32Array, sampleRate: number, timestampMs = Date.now()): PitchReading | null {
    void input;
    void sampleRate;
    void timestampMs;

    if (this.options.clarityThreshold && this.options.clarityThreshold > 1) {
      return null;
    }

    return null;
  }

  reset(): void {
    // Placeholder for future detector state.
  }
}
