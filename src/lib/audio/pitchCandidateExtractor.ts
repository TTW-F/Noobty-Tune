import type { PitchDetector } from "../../types/tuner";
import type { RawPitchCandidate } from "../../types/pitchTracking";

export function extractPitchCandidate(
  detector: PitchDetector,
  samples: Float32Array,
  sampleRate: number,
  timestampMs: number,
  algorithm: "yin" | "autocorrelation" = "yin",
): RawPitchCandidate {
  const reading = detector.detect(samples, sampleRate, timestampMs);

  if (!reading) {
    return {
      frequencyHz: null,
      clarity: 0,
      rms: calculateRms(samples),
      peak: calculatePeak(samples),
      timestampMs,
      algorithm,
    };
  }

  return {
    frequencyHz: reading.frequencyHz,
    clarity: reading.clarity,
    rms: reading.rms ?? calculateRms(samples),
    peak: calculatePeak(samples),
    timestampMs: reading.timestampMs,
    algorithm,
  };
}

export function extractMultipleCandidates(
  detectors: Array<{ detector: PitchDetector; algorithm: "yin" | "autocorrelation" }>,
  samples: Float32Array,
  sampleRate: number,
  timestampMs: number,
): RawPitchCandidate[] {
  return detectors.map(({ detector, algorithm }) =>
    extractPitchCandidate(detector, samples, sampleRate, timestampMs, algorithm),
  );
}

function calculateRms(samples: Float32Array): number {
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    sum += samples[index] * samples[index];
  }

  return Math.sqrt(sum / samples.length);
}

function calculatePeak(samples: Float32Array): number {
  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const absolute = Math.abs(samples[index]);
    if (absolute > peak) {
      peak = absolute;
    }
  }

  return peak;
}
