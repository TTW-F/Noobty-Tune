import type { PitchDetector, PitchReading } from "../../types/tuner";
import { getClosestNoteMatch } from "../music";

export interface PitchDetectorOptions {
  readonly algorithm: "yin" | "autocorrelation" | "placeholder";
  readonly clarityThreshold?: number;
  readonly probabilityThreshold?: number;
  readonly minFrequencyHz?: number;
  readonly maxFrequencyHz?: number;
  readonly rmsThreshold?: number;
}

export class YinPitchDetector implements PitchDetector {
  private readonly options: PitchDetectorOptions;

  constructor(options: PitchDetectorOptions = { algorithm: "yin" }) {
    this.options = options;
  }

  detect(input: Float32Array, sampleRate: number, timestampMs = Date.now()): PitchReading | null {
    if (input.length < 32) {
      return null;
    }

    const rms = calculateRms(input);
    const rmsThreshold = this.options.rmsThreshold ?? 0.01;
    if (rms < rmsThreshold) {
      return null;
    }

    const detection = detectPitchWithYin(input, sampleRate, {
      probabilityThreshold: this.options.probabilityThreshold ?? this.options.clarityThreshold ?? 0.85,
      minFrequencyHz: this.options.minFrequencyHz ?? 70,
      maxFrequencyHz: this.options.maxFrequencyHz ?? 360,
    });

    if (!detection) {
      return null;
    }

    const noteMatch = getClosestNoteMatch(detection.frequencyHz);

    return {
      frequencyHz: detection.frequencyHz,
      clarity: detection.clarity,
      timestampMs,
      source: "microphone",
      rms,
      noteName: noteMatch?.note,
      octave: noteMatch?.octave,
      cents: noteMatch?.cents,
    };
  }

  reset(): void {
    // Current YIN implementation is stateless between frames.
  }
}

export class PlaceholderPitchDetector extends YinPitchDetector {
  constructor(options: PitchDetectorOptions = { algorithm: "placeholder" }) {
    super({
      ...options,
      algorithm: options.algorithm === "placeholder" ? "yin" : options.algorithm,
    });
  }
}

interface YinDetection {
  readonly frequencyHz: number;
  readonly clarity: number;
}

interface YinInternalOptions {
  readonly probabilityThreshold: number;
  readonly minFrequencyHz: number;
  readonly maxFrequencyHz: number;
}

function detectPitchWithYin(
  input: Float32Array,
  sampleRate: number,
  options: YinInternalOptions,
): YinDetection | null {
  const maxTau = Math.min(Math.floor(sampleRate / options.minFrequencyHz), Math.floor(input.length / 2));
  const minTau = Math.max(2, Math.floor(sampleRate / options.maxFrequencyHz));

  if (maxTau <= minTau) {
    return null;
  }

  const yinBuffer = new Float32Array(maxTau + 1);
  yinBuffer[0] = 1;

  for (let tau = 1; tau <= maxTau; tau += 1) {
    let delta = 0;

    for (let index = 0; index < maxTau; index += 1) {
      const difference = input[index] - input[index + tau];
      delta += difference * difference;
    }

    yinBuffer[tau] = delta;
  }

  let runningSum = 0;
  for (let tau = 1; tau <= maxTau; tau += 1) {
    runningSum += yinBuffer[tau];
    yinBuffer[tau] = runningSum === 0 ? 1 : (yinBuffer[tau] * tau) / runningSum;
  }

  let bestTau = -1;

  for (let tau = minTau; tau <= maxTau; tau += 1) {
    if (yinBuffer[tau] < 1 - options.probabilityThreshold) {
      while (tau + 1 <= maxTau && yinBuffer[tau + 1] < yinBuffer[tau]) {
        tau += 1;
      }
      bestTau = tau;
      break;
    }
  }

  if (bestTau === -1) {
    let smallestValue = 1;
    for (let tau = minTau; tau <= maxTau; tau += 1) {
      if (yinBuffer[tau] < smallestValue) {
        smallestValue = yinBuffer[tau];
        bestTau = tau;
      }
    }
  }

  if (bestTau <= 0) {
    return null;
  }

  const refinedTau = parabolicInterpolation(yinBuffer, bestTau);
  const frequencyHz = sampleRate / refinedTau;
  const clarity = Math.max(0, Math.min(1, 1 - yinBuffer[bestTau]));

  if (
    !Number.isFinite(frequencyHz) ||
    frequencyHz < options.minFrequencyHz ||
    frequencyHz > options.maxFrequencyHz ||
    clarity < options.probabilityThreshold
  ) {
    return null;
  }

  return {
    frequencyHz,
    clarity,
  };
}

function parabolicInterpolation(buffer: Float32Array, tau: number): number {
  const previous = tau > 1 ? buffer[tau - 1] : buffer[tau];
  const current = buffer[tau];
  const next = tau + 1 < buffer.length ? buffer[tau + 1] : buffer[tau];
  const denominator = previous - 2 * current + next;

  if (denominator === 0) {
    return tau;
  }

  return tau + (previous - next) / (2 * denominator);
}

function calculateRms(input: Float32Array): number {
  let squaredSum = 0;

  for (let index = 0; index < input.length; index += 1) {
    squaredSum += input[index] * input[index];
  }

  return Math.sqrt(squaredSum / input.length);
}
