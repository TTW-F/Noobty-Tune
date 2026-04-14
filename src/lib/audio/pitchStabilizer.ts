import type { PitchReading, PitchStabilizer, StabilizedPitchReading, TuningTarget } from "../../types/tuner";
import { createDeviationFromCents, findClosestTuningTarget, getCentsOffset } from "../music";

export interface PitchStabilizerOptions {
  readonly requiredSamples?: number;
  readonly centsTolerance?: number;
  readonly clarityThreshold?: number;
  readonly maxHistory?: number;
}

export class RollingPitchStabilizer implements PitchStabilizer {
  private readonly options: PitchStabilizerOptions;
  private history: PitchReading[] = [];

  constructor(options: PitchStabilizerOptions = {}) {
    this.options = options;
  }

  push(reading: PitchReading | null, targetHint: TuningTarget | null = null): StabilizedPitchReading | null {
    if (!reading) {
      this.reset();
      return null;
    }

    const requiredSamples = this.options.requiredSamples ?? 3;
    const maxHistory = Math.max(requiredSamples, this.options.maxHistory ?? 5);
    const clarityThreshold = this.options.clarityThreshold ?? 0.8;

    if (reading.clarity < clarityThreshold) {
      this.reset();
      return null;
    }

    this.history = [...this.history, reading].slice(-maxHistory);
    const recentWindow = this.history.slice(-requiredSamples);

    const target = targetHint ?? findClosestTuningTarget(reading.frequencyHz);
    const referenceFrequencyHz = target?.frequencyHz ?? reading.frequencyHz;
    const centsValues = recentWindow.map((item) => getCentsOffset(item.frequencyHz, referenceFrequencyHz));
    const stable = recentWindow.length >= requiredSamples && getSpreadInCents(centsValues) <= (this.options.centsTolerance ?? 10);
    const frequencyHz = median(recentWindow.map((item) => item.frequencyHz));
    const clarity = average(recentWindow.map((item) => item.clarity));
    const rms = average(recentWindow.map((item) => item.rms ?? 0));
    const deviation = createDeviationFromCents(getCentsOffset(frequencyHz, referenceFrequencyHz));

    return {
      frequencyHz,
      clarity,
      timestampMs: recentWindow[recentWindow.length - 1].timestampMs,
      source: recentWindow[recentWindow.length - 1].source,
      rms,
      noteName: target?.note ?? recentWindow[recentWindow.length - 1].noteName,
      octave: target?.octave ?? recentWindow[recentWindow.length - 1].octave,
      cents: deviation.cents,
      stable,
      sampleCount: recentWindow.length,
      target,
    };
  }

  reset(): void {
    this.history = [];
  }
}

export class PlaceholderPitchStabilizer extends RollingPitchStabilizer {}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
  }

  return sorted[middleIndex];
}

function getSpreadInCents(values: number[]): number {
  if (values.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  const smallest = Math.min(...values);
  const largest = Math.max(...values);
  return largest - smallest;
}
