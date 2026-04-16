/**
 * Tuner configuration management
 * Provides centralized configuration with validation and defaults
 */

export interface TunerConfig {
  readonly audio: AudioConfig;
  readonly detection: DetectionConfig;
  readonly stabilization: StabilizationConfig;
  readonly ui: UiConfig;
}

export interface AudioConfig {
  readonly fftSize: number;
  readonly smoothingTimeConstant: number;
  readonly sampleRate?: number;
  readonly autoGainControl: boolean;
  readonly echoCancellation: boolean;
  readonly noiseSuppression: boolean;
}

export interface DetectionConfig {
  readonly algorithm: "yin" | "autocorrelation";
  readonly minFrequencyHz: number;
  readonly maxFrequencyHz: number;
  readonly probabilityThreshold: number;
  readonly rmsThreshold: number;
}

export interface StabilizationConfig {
  readonly requiredSamples: number;
  readonly centsTolerance: number;
  readonly clarityThreshold: number;
  readonly maxHistory: number;
}

export interface UiConfig {
  readonly inTuneTolerance: number;
  readonly updateIntervalMs: number;
  readonly showDebugInfo: boolean;
  readonly enablePerformanceMonitoring: boolean;
}

export const DEFAULT_TUNER_CONFIG: TunerConfig = {
  audio: {
    fftSize: 2048,
    smoothingTimeConstant: 0.05,
    autoGainControl: false,
    echoCancellation: false,
    noiseSuppression: false,
  },
  detection: {
    algorithm: "yin",
    minFrequencyHz: 70,
    maxFrequencyHz: 360,
    probabilityThreshold: 0.82,
    rmsThreshold: 0.008,
  },
  stabilization: {
    requiredSamples: 3,
    centsTolerance: 12,
    clarityThreshold: 0.82,
    maxHistory: 5,
  },
  ui: {
    inTuneTolerance: 5,
    updateIntervalMs: 75,
    showDebugInfo: false,
    enablePerformanceMonitoring: false,
  },
};

export class TunerConfigManager {
  private config: TunerConfig;

  constructor(initialConfig: Partial<TunerConfig> = {}) {
    this.config = this.mergeConfig(DEFAULT_TUNER_CONFIG, initialConfig);
  }

  getConfig(): TunerConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<TunerConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
  }

  resetToDefaults(): void {
    this.config = { ...DEFAULT_TUNER_CONFIG };
  }

  validateConfig(config: Partial<TunerConfig>): string[] {
    const errors: string[] = [];

    if (config.audio) {
      if (config.audio.fftSize && !this.isPowerOfTwo(config.audio.fftSize)) {
        errors.push("audio.fftSize must be a power of 2");
      }
      if (
        config.audio.smoothingTimeConstant !== undefined &&
        (config.audio.smoothingTimeConstant < 0 || config.audio.smoothingTimeConstant > 1)
      ) {
        errors.push("audio.smoothingTimeConstant must be between 0 and 1");
      }
    }

    if (config.detection) {
      if (
        config.detection.minFrequencyHz !== undefined &&
        config.detection.maxFrequencyHz !== undefined &&
        config.detection.minFrequencyHz >= config.detection.maxFrequencyHz
      ) {
        errors.push("detection.minFrequencyHz must be less than maxFrequencyHz");
      }
      if (
        config.detection.probabilityThreshold !== undefined &&
        (config.detection.probabilityThreshold < 0 || config.detection.probabilityThreshold > 1)
      ) {
        errors.push("detection.probabilityThreshold must be between 0 and 1");
      }
    }

    if (config.stabilization) {
      if (
        config.stabilization.requiredSamples !== undefined &&
        config.stabilization.requiredSamples < 1
      ) {
        errors.push("stabilization.requiredSamples must be at least 1");
      }
      if (
        config.stabilization.clarityThreshold !== undefined &&
        (config.stabilization.clarityThreshold < 0 ||
          config.stabilization.clarityThreshold > 1)
      ) {
        errors.push("stabilization.clarityThreshold must be between 0 and 1");
      }
    }

    return errors;
  }

  private mergeConfig(base: TunerConfig, updates: Partial<TunerConfig>): TunerConfig {
    return {
      audio: { ...base.audio, ...updates.audio },
      detection: { ...base.detection, ...updates.detection },
      stabilization: { ...base.stabilization, ...updates.stabilization },
      ui: { ...base.ui, ...updates.ui },
    };
  }

  private isPowerOfTwo(value: number): boolean {
    return value > 0 && (value & (value - 1)) === 0;
  }
}

/**
 * Preset configurations for different use cases
 */
export const TUNER_PRESETS = {
  /**
   * Balanced preset - good for most situations
   */
  balanced: DEFAULT_TUNER_CONFIG,

  /**
   * Fast response - prioritizes speed over stability
   */
  fastResponse: {
    ...DEFAULT_TUNER_CONFIG,
    stabilization: {
      requiredSamples: 2,
      centsTolerance: 15,
      clarityThreshold: 0.75,
      maxHistory: 3,
    },
    ui: {
      ...DEFAULT_TUNER_CONFIG.ui,
      updateIntervalMs: 50,
    },
  } as TunerConfig,

  /**
   * High precision - prioritizes accuracy over speed
   */
  highPrecision: {
    ...DEFAULT_TUNER_CONFIG,
    detection: {
      ...DEFAULT_TUNER_CONFIG.detection,
      probabilityThreshold: 0.9,
      rmsThreshold: 0.01,
    },
    stabilization: {
      requiredSamples: 5,
      centsTolerance: 8,
      clarityThreshold: 0.85,
      maxHistory: 8,
    },
    ui: {
      ...DEFAULT_TUNER_CONFIG.ui,
      inTuneTolerance: 3,
      updateIntervalMs: 100,
    },
  } as TunerConfig,

  /**
   * Low frequency - optimized for bass strings
   */
  lowFrequency: {
    ...DEFAULT_TUNER_CONFIG,
    audio: {
      ...DEFAULT_TUNER_CONFIG.audio,
      fftSize: 4096,
    },
    detection: {
      ...DEFAULT_TUNER_CONFIG.detection,
      minFrequencyHz: 40,
      maxFrequencyHz: 200,
      probabilityThreshold: 0.85,
    },
    stabilization: {
      requiredSamples: 4,
      centsTolerance: 10,
      clarityThreshold: 0.8,
      maxHistory: 6,
    },
  } as TunerConfig,
};
