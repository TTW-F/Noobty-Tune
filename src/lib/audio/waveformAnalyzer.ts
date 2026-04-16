/**
 * Waveform analyzer for extracting visual features from audio
 * Useful for debugging and creating visual feedback
 */

export interface WaveformFeatures {
  readonly peaks: readonly number[];
  readonly troughs: readonly number[];
  readonly envelope: readonly number[];
  readonly averageAmplitude: number;
  readonly peakAmplitude: number;
  readonly crestFactor: number;
}

export interface WaveformAnalyzer {
  analyze(samples: Float32Array, options?: WaveformAnalysisOptions): WaveformFeatures;
  extractEnvelope(samples: Float32Array, windowSize?: number): Float32Array;
  findPeaks(samples: Float32Array, threshold?: number): number[];
  downsample(samples: Float32Array, targetSize: number): Float32Array;
}

export interface WaveformAnalysisOptions {
  readonly peakThreshold?: number;
  readonly envelopeWindowSize?: number;
}

export class SimpleWaveformAnalyzer implements WaveformAnalyzer {
  analyze(
    samples: Float32Array,
    options: WaveformAnalysisOptions = {},
  ): WaveformFeatures {
    const peakThreshold = options.peakThreshold ?? 0.1;
    const envelopeWindowSize = options.envelopeWindowSize ?? 64;

    const peaks = this.findPeaks(samples, peakThreshold);
    const troughs = this.findTroughs(samples, peakThreshold);
    const envelope = Array.from(this.extractEnvelope(samples, envelopeWindowSize));

    let sumAbs = 0;
    let maxAbs = 0;

    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]);
      sumAbs += abs;
      if (abs > maxAbs) {
        maxAbs = abs;
      }
    }

    const averageAmplitude = sumAbs / samples.length;
    const peakAmplitude = maxAbs;

    // Crest factor: ratio of peak to RMS
    const rms = this.calculateRms(samples);
    const crestFactor = rms > 0 ? peakAmplitude / rms : 0;

    return {
      peaks,
      troughs,
      envelope,
      averageAmplitude,
      peakAmplitude,
      crestFactor,
    };
  }

  extractEnvelope(samples: Float32Array, windowSize = 64): Float32Array {
    const envelope = new Float32Array(samples.length);
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < samples.length; i++) {
      const start = Math.max(0, i - halfWindow);
      const end = Math.min(samples.length, i + halfWindow);
      let maxInWindow = 0;

      for (let j = start; j < end; j++) {
        const abs = Math.abs(samples[j]);
        if (abs > maxInWindow) {
          maxInWindow = abs;
        }
      }

      envelope[i] = maxInWindow;
    }

    return envelope;
  }

  findPeaks(samples: Float32Array, threshold = 0.1): number[] {
    const peaks: number[] = [];

    for (let i = 1; i < samples.length - 1; i++) {
      const current = samples[i];
      const prev = samples[i - 1];
      const next = samples[i + 1];

      if (current > prev && current > next && current > threshold) {
        peaks.push(i);
      }
    }

    return peaks;
  }

  private findTroughs(samples: Float32Array, threshold = 0.1): number[] {
    const troughs: number[] = [];

    for (let i = 1; i < samples.length - 1; i++) {
      const current = samples[i];
      const prev = samples[i - 1];
      const next = samples[i + 1];

      if (current < prev && current < next && current < -threshold) {
        troughs.push(i);
      }
    }

    return troughs;
  }

  downsample(samples: Float32Array, targetSize: number): Float32Array {
    if (targetSize >= samples.length) {
      return samples;
    }

    const downsampled = new Float32Array(targetSize);
    const blockSize = samples.length / targetSize;

    for (let i = 0; i < targetSize; i++) {
      const start = Math.floor(i * blockSize);
      const end = Math.floor((i + 1) * blockSize);
      let sum = 0;

      for (let j = start; j < end; j++) {
        sum += Math.abs(samples[j]);
      }

      downsampled[i] = sum / (end - start);
    }

    return downsampled;
  }

  private calculateRms(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }
}
