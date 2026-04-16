import { describe, it } from "node:test";
import assert from "node:assert";
import { TunerConfigManager, DEFAULT_TUNER_CONFIG, TUNER_PRESETS } from "./tunerConfig";

describe("TunerConfigManager", () => {
  it("initializes with default config", () => {
    const manager = new TunerConfigManager();
    const config = manager.getConfig();

    assert.deepStrictEqual(config, DEFAULT_TUNER_CONFIG);
  });

  it("merges partial config updates", () => {
    const manager = new TunerConfigManager();

    manager.updateConfig({
      detection: {
        ...DEFAULT_TUNER_CONFIG.detection,
        minFrequencyHz: 50,
      },
    });

    const config = manager.getConfig();
    assert.strictEqual(config.detection.minFrequencyHz, 50);
    assert.strictEqual(config.detection.maxFrequencyHz, DEFAULT_TUNER_CONFIG.detection.maxFrequencyHz);
  });

  it("validates fftSize is power of two", () => {
    const manager = new TunerConfigManager();

    const errors = manager.validateConfig({
      audio: {
        ...DEFAULT_TUNER_CONFIG.audio,
        fftSize: 1000, // Not a power of 2
      },
    });

    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes("power of 2"));
  });

  it("validates frequency range", () => {
    const manager = new TunerConfigManager();

    const errors = manager.validateConfig({
      detection: {
        ...DEFAULT_TUNER_CONFIG.detection,
        minFrequencyHz: 500,
        maxFrequencyHz: 100, // Invalid: min > max
      },
    });

    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes("less than"));
  });

  it("validates threshold ranges", () => {
    const manager = new TunerConfigManager();

    const errors = manager.validateConfig({
      detection: {
        ...DEFAULT_TUNER_CONFIG.detection,
        probabilityThreshold: 1.5, // Invalid: > 1
      },
    });

    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes("between 0 and 1"));
  });

  it("resets to defaults", () => {
    const manager = new TunerConfigManager();

    manager.updateConfig({
      detection: {
        ...DEFAULT_TUNER_CONFIG.detection,
        minFrequencyHz: 50,
      },
    });

    manager.resetToDefaults();

    const config = manager.getConfig();
    assert.deepStrictEqual(config, DEFAULT_TUNER_CONFIG);
  });

  it("provides valid presets", () => {
    const manager = new TunerConfigManager();

    // Test each preset
    for (const [name, preset] of Object.entries(TUNER_PRESETS)) {
      const errors = manager.validateConfig(preset);
      assert.strictEqual(errors.length, 0, `Preset ${name} should be valid`);
    }
  });

  it("fast response preset has lower required samples", () => {
    assert.ok(
      TUNER_PRESETS.fastResponse.stabilization.requiredSamples <
        DEFAULT_TUNER_CONFIG.stabilization.requiredSamples,
    );
  });

  it("high precision preset has stricter thresholds", () => {
    assert.ok(
      TUNER_PRESETS.highPrecision.detection.probabilityThreshold >
        DEFAULT_TUNER_CONFIG.detection.probabilityThreshold,
    );
    assert.ok(
      TUNER_PRESETS.highPrecision.ui.inTuneTolerance <
        DEFAULT_TUNER_CONFIG.ui.inTuneTolerance,
    );
  });

  it("low frequency preset has larger FFT size", () => {
    assert.ok(
      TUNER_PRESETS.lowFrequency.audio.fftSize > DEFAULT_TUNER_CONFIG.audio.fftSize,
    );
    assert.ok(
      TUNER_PRESETS.lowFrequency.detection.minFrequencyHz <
        DEFAULT_TUNER_CONFIG.detection.minFrequencyHz,
    );
  });
});
