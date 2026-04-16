/**
 * Audio quality analyzer for detecting signal issues
 * Helps identify clipping, noise, and weak signals
 */

export interface AudioQualityReport {
  readonly isClipping: boolean;
  readonly isNoisy: boolean;
  readonly isWeak: boolean;
  readonly signalToNoiseRatio: number | null;
  readonly dynamicRange: number;
  readonly peakLevel: number;
  readonly rmsLevel: number;
  readonly zeroCrossingRate: number;
  readonly recommendation: string;
}

export interface AudioQualityAnalyzer {
  analyze(samples: Float32Array): AudioQualityReport;
}

export class SimpleAudioQualityAnalyzer implements AudioQualityAnalyzer {
  private readonly clippingThreshold: number;
  private readonly weakSignalThreshold: number;
  private readonly noisyZcrThreshold: number;

  constructor(
    clippingThreshold = 0.95,
    weakSignalThreshold = 0.005,
    noisyZcrThreshold = 0.3,
  ) {
    this.clippingThreshold = clippingThreshold;
    this.weakSignalThreshold = weakSignalThreshold;
    this.noisyZcrThreshold = noisyZcrThreshold;
  }

  analyze(samples: Float32Array): AudioQualityReport {
    const rmsLevel = this.calculateRms(samples);
    const peakLevel = this.calculatePeak(samples);
    const zeroCrossingRate = this.calculateZeroCrossingRate(samples);
    const dynamicRange = this.calculateDynamicRange(samples);

    const isClipping = peakLevel >= this.clippingThreshold;
    const isWeak = rmsLevel < this.weakSignalThreshold;
    const isNoisy = zeroCrossingRate > this.noisyZcrThreshold;

    // Simple SNR estimation based on signal characteristics
    const signalToNoiseRatio = this.estimateSnr(samples, rmsLevel);

    const recommendation = this.generateRecommendation(
      isClipping,
      isWeak,
      isNoisy,
      signalToNoiseRatio,
    );

    return {
      isClipping,
      isNoisy,
      isWeak,
      signalToNoiseRatio,
      dynamicRange,
      peakLevel,
      rmsLevel,
      zeroCrossingRate,
      recommendation,
    };
  }

  private calculateRms(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  private calculatePeak(samples: Float32Array): number {
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > peak) {
        peak = abs;
      }
    }
    return peak;
  }

  private calculateZeroCrossingRate(samples: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < samples.length; i++) {
      if ((samples[i - 1] >= 0 && samples[i] < 0) || (samples[i - 1] < 0 && samples[i] >= 0)) {
        crossings++;
      }
    }
    return crossings / samples.length;
  }

  private calculateDynamicRange(samples: Float32Array): number {
    const peak = this.calculatePeak(samples);
    const rms = this.calculateRms(samples);
    if (rms === 0) {
      return 0;
    }
    return 20 * Math.log10(peak / rms);
  }

  private estimateSnr(samples: Float32Array, rmsLevel: number): number | null {
    if (rmsLevel < 0.001) {
      return null;
    }

    // Estimate noise floor from quietest 10% of samples
    const sortedAbs = Array.from(samples)
      .map(Math.abs)
      .sort((a, b) => a - b);
    const noiseFloorIndex = Math.floor(sortedAbs.length * 0.1);
    const noiseFloor = sortedAbs[noiseFloorIndex];

    if (noiseFloor === 0) {
      return null;
    }

    return 20 * Math.log10(rmsLevel / noiseFloor);
  }

  private generateRecommendation(
    isClipping: boolean,
    isWeak: boolean,
    isNoisy: boolean,
    snr: number | null,
  ): string {
    if (isClipping) {
      return "Input is clipping. Reduce microphone gain or move further from the sound source.";
    }

    if (isWeak) {
      return "Signal is too weak. Move closer to the microphone or increase input volume.";
    }

    if (isNoisy) {
      return "High noise detected. Try a quieter environment or use a better microphone.";
    }

    if (snr !== null && snr < 10) {
      return "Low signal-to-noise ratio. Reduce background noise or improve microphone placement.";
    }

    return "Audio quality looks good.";
  }
}
