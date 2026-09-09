import type {
  PitchTrackingState,
  RawPitchCandidate,
  TuningInterpretation,
  TunerViewModel,
} from "../../../types/pitchTracking";
import type { TunerState } from "../../../types/tuner";
import { STANDARD_GUITAR_TUNING } from "../../../lib/music";
import { INITIAL_TUNER_STATE } from "../model/tunerState";
import { createEmptyViewModel } from "../model/tunerViewModel";
import type { LiveAudioSample } from "../model/useTunerPrototype";

/**
 * ?demo=<key> 视觉验证夹具:不改引擎,只为逐状态截图自审。
 */

export type DemoFixture = {
  state: TunerState;
  viewModel: TunerViewModel;
  interpretation: TuningInterpretation | null;
  trackingState: PitchTrackingState | null;
  rawCandidate: RawPitchCandidate | null;
  frameRms: number | null;
  activeInputLabel: string | null;
  liveSample: LiveAudioSample;
};

const NOW = 0;
const TARGET_E2 = STANDARD_GUITAR_TUNING[0];

function listeningState(overrides: Partial<TunerState>): TunerState {
  return {
    ...INITIAL_TUNER_STATE,
    audioStatus: "listening",
    uiStatus: "listening",
    ...overrides,
  };
}

function lockedTracking(frequencyHz: number): PitchTrackingState {
  return {
    trackedFrequencyHz: frequencyHz,
    confidence: 0.95,
    stage: "locked",
    lastStableFrequencyHz: frequencyHz,
    stableDurationMs: 900,
    holdRemainingMs: 0,
    mismatchCount: 0,
    timestampMs: NOW,
  };
}

function lockedInterpretation(cents: number, frequencyHz: number, direction: TuningInterpretation["direction"]): TuningInterpretation {
  return {
    detectedFrequencyHz: frequencyHz,
    detectedNote: "E2",
    targetId: "string-6",
    targetFrequencyHz: TARGET_E2.frequencyHz,
    centsOffset: cents,
    direction,
    confidence: 0.95,
    trackingStage: "locked",
  };
}

function lockedCandidate(frequencyHz: number): RawPitchCandidate {
  return {
    frequencyHz,
    clarity: 0.95,
    rms: 0.021,
    peak: 0.09,
    timestampMs: NOW,
    algorithm: "yin",
  };
}

function stabilizedE2(frequencyHz: number, cents: number, stable: boolean): TunerState["stabilizedPitch"] {
  return {
    frequencyHz,
    clarity: 0.95,
    timestampMs: NOW,
    source: "microphone",
    rms: 0.021,
    noteName: "E",
    octave: 2,
    cents,
    stable,
    sampleCount: 3,
    target: TARGET_E2,
  };
}

function flatSharpFixture(cents: number, direction: "flat" | "sharp"): DemoFixture {
  const frequencyHz = TARGET_E2.frequencyHz * Math.pow(2, cents / 1200);
  return {
    state: listeningState({
      uiStatus: direction === "flat" ? "detecting" : "detecting",
      activeTarget: TARGET_E2,
      deviation: { cents, direction },
      detectedPitch: {
        frequencyHz,
        clarity: 0.95,
        timestampMs: NOW,
        source: "microphone",
        rms: 0.021,
        noteName: "E",
        octave: 2,
        cents,
      },
      stabilizedPitch: stabilizedE2(frequencyHz, cents, false),
    }),
    viewModel: {
      uiStage: "locked",
      displayFrequency: "E2",
      displayCents: `${cents > 0 ? "+" : ""}${Math.round(cents)}¢`,
      displayTarget: "E2 (6弦)",
      needlePosition: cents / 50,
      showSuccess: false,
      statusMessage: "",
      confidence: 0.95,
    },
    interpretation: lockedInterpretation(cents, frequencyHz, direction),
    trackingState: lockedTracking(frequencyHz),
    rawCandidate: lockedCandidate(frequencyHz),
    frameRms: 0.021,
    activeInputLabel: "默认 — 麦克风 (Realtek Audio)",
    liveSample: {
      timestampMs: NOW,
      rms: 0.021,
      peak: 0.09,
      frequencyHz,
      trackedFrequencyHz: frequencyHz,
      confidence: 0.95,
      stage: "locked",
      centsOffset: cents,
    },
  };
}

export const DEMO_SCENARIOS: Record<string, DemoFixture> = {
  idle: {
    state: INITIAL_TUNER_STATE,
    viewModel: createEmptyViewModel(),
    interpretation: null,
    trackingState: null,
    rawCandidate: null,
    frameRms: null,
    activeInputLabel: null,
    liveSample: { timestampMs: 0, rms: 0, peak: 0, frequencyHz: null, trackedFrequencyHz: null, confidence: 0, stage: "idle", centsOffset: null },
  },
  listening: {
    state: listeningState({}),
    viewModel: createEmptyViewModel(),
    interpretation: null,
    trackingState: null,
    rawCandidate: null,
    frameRms: 0.006,
    activeInputLabel: "默认 — 麦克风 (Realtek Audio)",
    liveSample: { timestampMs: NOW, rms: 0.006, peak: 0.02, frequencyHz: null, trackedFrequencyHz: null, confidence: 0, stage: "idle", centsOffset: null },
  },
  silent: {
    state: listeningState({}),
    viewModel: createEmptyViewModel(),
    interpretation: null,
    trackingState: null,
    rawCandidate: null,
    frameRms: 0.0004,
    activeInputLabel: "默认 — 麦克风 (Realtek Audio)",
    liveSample: { timestampMs: NOW, rms: 0.0004, peak: 0.002, frequencyHz: null, trackedFrequencyHz: null, confidence: 0, stage: "idle", centsOffset: null },
  },
  weak: {
    state: listeningState({ uiStatus: "signal-weak" }),
    viewModel: createEmptyViewModel(),
    interpretation: null,
    trackingState: null,
    rawCandidate: { frequencyHz: null, clarity: 0.1, rms: 0.0012, peak: 0.02, timestampMs: NOW, algorithm: "yin" },
    frameRms: 0.0012,
    activeInputLabel: "默认 — 麦克风 (Realtek Audio)",
    liveSample: { timestampMs: NOW, rms: 0.0012, peak: 0.02, frequencyHz: null, trackedFrequencyHz: null, confidence: 0, stage: "idle", centsOffset: null },
  },
  flat: flatSharpFixture(-18, "flat"),
  sharp: flatSharpFixture(22, "sharp"),
  manual: {
    // 手动锁定 5 弦 A2,但弹的是 6 弦的音 → 错音提示
    state: listeningState({
      uiStatus: "detecting",
      selection: { mode: "manual", targetId: "string-5" },
      activeTarget: STANDARD_GUITAR_TUNING[1],
      deviation: { cents: -499.8, direction: "flat" },
      detectedPitch: {
        frequencyHz: 82.4,
        clarity: 0.9,
        timestampMs: NOW,
        source: "microphone",
        rms: 0.021,
        noteName: "E",
        octave: 2,
        cents: 0,
      },
    }),
    viewModel: {
      uiStage: "locked",
      displayFrequency: "E2",
      displayCents: "-500¢",
      displayTarget: "A2 (5弦)",
      needlePosition: -1,
      showSuccess: false,
      statusMessage: "",
      confidence: 0.9,
    },
    interpretation: {
      detectedFrequencyHz: 82.4,
      detectedNote: "E2",
      targetId: "string-5",
      targetFrequencyHz: 110,
      centsOffset: -499.8,
      direction: "flat",
      confidence: 0.9,
      trackingStage: "locked",
    },
    trackingState: lockedTracking(82.4),
    rawCandidate: lockedCandidate(82.4),
    frameRms: 0.021,
    activeInputLabel: "默认 — 麦克风 (Realtek Audio)",
    liveSample: {
      timestampMs: NOW,
      rms: 0.021,
      peak: 0.09,
      frequencyHz: 82.4,
      trackedFrequencyHz: 82.4,
      confidence: 0.9,
      stage: "locked",
      centsOffset: -499.8,
    },
  },
  tune: {
    state: listeningState({
      uiStatus: "in-tune",
      activeTarget: TARGET_E2,
      deviation: { cents: 1.8, direction: "in-tune" },
      detectedPitch: {
        frequencyHz: 82.51,
        clarity: 0.97,
        timestampMs: NOW,
        source: "microphone",
        rms: 0.021,
        noteName: "E",
        octave: 2,
        cents: 1.8,
      },
      stabilizedPitch: stabilizedE2(82.51, 1.8, true),
    }),
    viewModel: {
      uiStage: "locked",
      displayFrequency: "E2",
      displayCents: "+2¢",
      displayTarget: "E2 (6弦)",
      needlePosition: 0.036,
      showSuccess: true,
      statusMessage: "",
      confidence: 0.97,
    },
    interpretation: lockedInterpretation(1.8, 82.51, "in-tune"),
    trackingState: lockedTracking(82.51),
    rawCandidate: lockedCandidate(82.51),
    frameRms: 0.021,
    activeInputLabel: "默认 — 麦克风 (Realtek Audio)",
    liveSample: {
      timestampMs: NOW,
      rms: 0.021,
      peak: 0.09,
      frequencyHz: 82.51,
      trackedFrequencyHz: 82.51,
      confidence: 0.97,
      stage: "locked",
      centsOffset: 1.8,
    },
  },
  denied: {
    state: {
      ...INITIAL_TUNER_STATE,
      audioStatus: "permission-denied",
      uiStatus: "permission-denied",
      lastError: {
        code: "NotAllowedError",
        message: "Permission denied",
        recoverable: false,
      },
    },
    viewModel: createEmptyViewModel(),
    interpretation: null,
    trackingState: null,
    rawCandidate: null,
    frameRms: null,
    activeInputLabel: null,
    liveSample: { timestampMs: 0, rms: 0, peak: 0, frequencyHz: null, trackedFrequencyHz: null, confidence: 0, stage: "idle", centsOffset: null },
  },
};
