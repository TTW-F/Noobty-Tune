import type { PitchDetector, PitchReading } from "../../types/tuner";
import { getClosestNoteMatch } from "../music";

export interface PitchDetectorOptions {
  readonly algorithm: "yin" | "autocorrelation" | "placeholder";
  /**
   * Sensitivity used to locate the primary period candidate.
   * YIN searches for the first CMND valley below `1 - probabilityThreshold`.
   * This is NOT an acceptance gate: weaker candidates are still reported with
   * their honest clarity so the tracker's two-tier thresholds can decide.
   */
  readonly probabilityThreshold?: number;
  /** Legacy alias for `probabilityThreshold`. */
  readonly clarityThreshold?: number;
  /**
   * Hard noise floor. Candidates whose clarity falls below this value carry no
   * usable period information and are dropped instead of reported.
   */
  readonly clarityFloor?: number;
  readonly minFrequencyHz?: number;
  readonly maxFrequencyHz?: number;
  readonly rmsThreshold?: number;
}

const DEFAULT_CLARITY_FLOOR = 0.3;
const AUTOCORRELATION_PEAK_PICK_RATIO = 0.9;
/**
 * Octave-up correction: when the fundamental is heavily attenuated (laptop
 * mics roll off below ~150 Hz, hitting the low E string first), the CMND dips
 * below threshold at tau0/2 first. The true period then shows a valley at
 * twice that lag that is dramatically deeper. Only a decisive deepening
 * triggers the doubling so a clean signal, whose 2*tau valley has the same
 * depth, is never doubled.
 */
const OCTAVE_CORRECTION_FACTOR = 0.5;

export class YinPitchDetector implements PitchDetector {
  private readonly options: PitchDetectorOptions;
  private readonly differenceScratch: ScratchBuffer = { buffer: new Float32Array(0) };

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
      clarityFloor: this.options.clarityFloor ?? DEFAULT_CLARITY_FLOOR,
      minFrequencyHz: this.options.minFrequencyHz ?? 70,
      maxFrequencyHz: this.options.maxFrequencyHz ?? 360,
    }, this.differenceScratch);

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
    // The scratch buffer is intentionally kept; it is content-independent.
  }
}

export class AutoCorrelationPitchDetector implements PitchDetector {
  private readonly options: PitchDetectorOptions;
  private readonly correlationScratch: ScratchBuffer = { buffer: new Float32Array(0) };
  private readonly energyPrefixScratch: ScratchBuffer = { buffer: new Float32Array(0) };

  constructor(options: PitchDetectorOptions = { algorithm: "autocorrelation" }) {
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

    const detection = detectPitchWithAutocorrelation(input, sampleRate, {
      probabilityThreshold: this.options.probabilityThreshold ?? this.options.clarityThreshold ?? 0.75,
      clarityFloor: this.options.clarityFloor ?? DEFAULT_CLARITY_FLOOR,
      minFrequencyHz: this.options.minFrequencyHz ?? 70,
      maxFrequencyHz: this.options.maxFrequencyHz ?? 360,
    }, this.correlationScratch, this.energyPrefixScratch);

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
    // The scratch buffers are intentionally kept; they are content-independent.
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
  readonly clarityFloor: number;
  readonly minFrequencyHz: number;
  readonly maxFrequencyHz: number;
}

interface ScratchBuffer {
  buffer: Float32Array;
}

function ensureCapacity(scratch: ScratchBuffer, length: number): Float32Array {
  if (scratch.buffer.length < length) {
    scratch.buffer = new Float32Array(length);
  }

  return scratch.buffer;
}

/**
 * Standard YIN (de Cheveigné & Kawahara, 2002) with two deviations that matter
 * for real instrument signals:
 *
 * 1. The difference function integrates over `sampleCount - maxTau` samples.
 *    The integration window then covers several periods even on the low E
 *    string, which deepens the CMND valley and stabilises clarity there.
 *
 * 2. When no valley dips below the search threshold, the global minimum is
 *    reported with its honest clarity instead of being rejected. The tracker
 *    gates candidates with its own lock/hold thresholds, so hiding marginal
 *    frames from it only destroys the sustain-phase tracking it was designed
 *    for. Only frames below `clarityFloor` are dropped as pure noise.
 */
function detectPitchWithYin(
  input: Float32Array,
  sampleRate: number,
  options: YinInternalOptions,
  differenceScratch: ScratchBuffer,
): YinDetection | null {
  const sampleCount = input.length;
  const maxTau = Math.min(Math.floor(sampleRate / options.minFrequencyHz), Math.floor(sampleCount / 2));
  const minTau = Math.max(2, Math.floor(sampleRate / options.maxFrequencyHz));

  if (maxTau <= minTau) {
    return null;
  }

  const differenceBuffer = ensureCapacity(differenceScratch, maxTau + 1);
  const windowSize = sampleCount - maxTau;

  differenceBuffer[0] = 1;
  for (let tau = 1; tau <= maxTau; tau += 1) {
    let delta = 0;

    for (let index = 0; index < windowSize; index += 1) {
      const difference = input[index] - input[index + tau];
      delta += difference * difference;
    }

    differenceBuffer[tau] = delta;
  }

  let runningSum = 0;
  for (let tau = 1; tau <= maxTau; tau += 1) {
    runningSum += differenceBuffer[tau];
    differenceBuffer[tau] = runningSum === 0 ? 1 : (differenceBuffer[tau] * tau) / runningSum;
  }

  const searchThreshold = 1 - options.probabilityThreshold;
  let bestTau = findFirstValleyBelow(differenceBuffer, minTau, maxTau, searchThreshold)
    ?? findGlobalMinimum(differenceBuffer, minTau, maxTau);

  if (bestTau === null) {
    return null;
  }

  // If the valley at twice the lag is decisively deeper, the found dip was an
  // artifact of even-harmonic dominance and the real period is the multiple.
  while (
    2 * bestTau <= maxTau &&
    differenceBuffer[2 * bestTau] < OCTAVE_CORRECTION_FACTOR * differenceBuffer[bestTau]
  ) {
    bestTau *= 2;
  }

  const refinedTau = parabolicInterpolation(differenceBuffer, bestTau);
  const frequencyHz = sampleRate / refinedTau;
  const clarity = clamp01(1 - differenceBuffer[bestTau]);

  if (
    !Number.isFinite(frequencyHz) ||
    frequencyHz < options.minFrequencyHz ||
    frequencyHz > options.maxFrequencyHz ||
    clarity < options.clarityFloor
  ) {
    return null;
  }

  return {
    frequencyHz,
    clarity,
  };
}

/**
 * Normalised autocorrelation with McLeod-style peak picking. Taking the global
 * maximum over the lag range is biased towards multiples of the period (the
 * correlation at 2*tau0 is nearly as high as at tau0), which reads an octave
 * low. Picking the first local peak within 10% of the maximum removes that
 * bias. Marginal frames are reported with honest clarity like the YIN path.
 */
function detectPitchWithAutocorrelation(
  input: Float32Array,
  sampleRate: number,
  options: YinInternalOptions,
  correlationScratch: ScratchBuffer,
  energyPrefixScratch: ScratchBuffer,
): YinDetection | null {
  const sampleCount = input.length;
  const maxTau = Math.min(Math.floor(sampleRate / options.minFrequencyHz), sampleCount - 1);
  const minTau = Math.max(2, Math.floor(sampleRate / options.maxFrequencyHz));

  if (maxTau <= minTau) {
    return null;
  }

  const correlationBuffer = ensureCapacity(correlationScratch, maxTau + 1);
  const energyPrefixBuffer = ensureCapacity(energyPrefixScratch, sampleCount + 1);

  // Prefix sums of squared samples give the overlap-window energies for every
  // lag in constant time.
  energyPrefixBuffer[0] = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    energyPrefixBuffer[index + 1] = energyPrefixBuffer[index] + input[index] * input[index];
  }

  let bestCorrelation = 0;

  for (let tau = minTau; tau <= maxTau; tau += 1) {
    const overlapLength = sampleCount - tau;
    let numerator = 0;

    for (let index = 0; index < overlapLength; index += 1) {
      numerator += input[index] * input[index + tau];
    }

    const energyA = energyPrefixBuffer[overlapLength];
    const energyB = energyPrefixBuffer[sampleCount] - energyPrefixBuffer[tau];
    const denominator = Math.sqrt(energyA * energyB);
    const correlation = denominator > 0 ? numerator / denominator : 0;
    correlationBuffer[tau] = correlation;

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
    }
  }

  if (bestCorrelation <= 0) {
    return null;
  }

  const bestTau = findFirstPeakWithin(
    correlationBuffer,
    minTau,
    maxTau,
    bestCorrelation * AUTOCORRELATION_PEAK_PICK_RATIO,
  );

  if (bestTau === null) {
    return null;
  }

  const refinedTau = parabolicInterpolation(correlationBuffer, bestTau);
  const frequencyHz = sampleRate / refinedTau;
  const clarity = clamp01(correlationBuffer[bestTau]);

  if (
    !Number.isFinite(frequencyHz) ||
    frequencyHz < options.minFrequencyHz ||
    frequencyHz > options.maxFrequencyHz ||
    clarity < options.clarityFloor
  ) {
    return null;
  }

  return {
    frequencyHz,
    clarity,
  };
}

function findFirstValleyBelow(
  buffer: Float32Array,
  minTau: number,
  maxTau: number,
  threshold: number,
): number | null {
  for (let tau = minTau; tau <= maxTau; tau += 1) {
    if (buffer[tau] < threshold) {
      while (tau + 1 <= maxTau && buffer[tau + 1] < buffer[tau]) {
        tau += 1;
      }
      return tau;
    }
  }

  return null;
}

function findGlobalMinimum(buffer: Float32Array, minTau: number, maxTau: number): number | null {
  let bestTau: number | null = null;
  let smallestValue = Number.POSITIVE_INFINITY;

  for (let tau = minTau; tau <= maxTau; tau += 1) {
    if (buffer[tau] < smallestValue) {
      smallestValue = buffer[tau];
      bestTau = tau;
    }
  }

  return bestTau;
}

function findFirstPeakWithin(
  buffer: Float32Array,
  minTau: number,
  maxTau: number,
  threshold: number,
): number | null {
  for (let tau = minTau; tau <= maxTau; tau += 1) {
    const previous = tau > minTau ? buffer[tau - 1] : Number.NEGATIVE_INFINITY;
    const next = tau < maxTau ? buffer[tau + 1] : Number.NEGATIVE_INFINITY;

    if (buffer[tau] >= threshold && buffer[tau] >= previous && buffer[tau] >= next) {
      return tau;
    }
  }

  return findGlobalMaximum(buffer, minTau, maxTau);
}

function findGlobalMaximum(buffer: Float32Array, minTau: number, maxTau: number): number | null {
  let bestTau: number | null = null;
  let largestValue = Number.NEGATIVE_INFINITY;

  for (let tau = minTau; tau <= maxTau; tau += 1) {
    if (buffer[tau] > largestValue) {
      largestValue = buffer[tau];
      bestTau = tau;
    }
  }

  return bestTau;
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function calculateRms(input: Float32Array): number {
  let squaredSum = 0;

  for (let index = 0; index < input.length; index += 1) {
    squaredSum += input[index] * input[index];
  }

  return Math.sqrt(squaredSum / input.length);
}
