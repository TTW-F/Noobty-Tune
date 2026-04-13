import type { PitchReading, PitchStabilizer, StabilizedPitchReading } from "../../types/tuner";

export interface PitchStabilizerOptions {
  readonly requiredSamples?: number;
  readonly centsTolerance?: number;
}

export class PlaceholderPitchStabilizer implements PitchStabilizer {
  private readonly options: PitchStabilizerOptions;
  private sampleCount = 0;

  constructor(options: PitchStabilizerOptions = {}) {
    this.options = options;
  }

  push(reading: PitchReading | null): StabilizedPitchReading | null {
    if (!reading) {
      this.reset();
      return null;
    }

    this.sampleCount += 1;
    const requiredSamples = this.options.requiredSamples ?? 3;

    return {
      ...reading,
      stable: this.sampleCount >= requiredSamples,
      sampleCount: this.sampleCount,
    };
  }

  reset(): void {
    this.sampleCount = 0;
  }
}
