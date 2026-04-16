import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ContinuousPitchTracker } from "../continuousPitchTracker";
import type { RawPitchCandidate } from "../../../types/pitchTracking";

describe("ContinuousPitchTracker", () => {
  let tracker: ContinuousPitchTracker;
  let timestampMs: number;

  beforeEach(() => {
    tracker = new ContinuousPitchTracker({
      holdDurationMs: 225,
      releaseAfterMisses: 6,
    });
    timestampMs = 0;
  });

  it("enters acquiring on the first valid candidate", () => {
    const state = tracker.update(createCandidate(82.41, 0.9, nextTimestamp()));

    assert.equal(state.stage, "acquiring");
    assert.equal(state.trackedFrequencyHz, 82.41);
  });

  it("promotes to tracking before lock when continuity exists but clarity is still below lock threshold", () => {
    tracker.update(createCandidate(82.41, 0.7, nextTimestamp()));
    tracker.update(createCandidate(82.40, 0.74, nextTimestamp()));
    const state = tracker.update(createCandidate(82.42, 0.76, nextTimestamp()));

    assert.equal(state.stage, "tracking");
    assert.ok((state.trackedFrequencyHz ?? 0) > 82.3);
  });

  it("locks after enough contiguous high-clarity frames", () => {
    tracker.update(createCandidate(82.41, 0.86, nextTimestamp()));
    tracker.update(createCandidate(82.40, 0.87, nextTimestamp()));
    const state = tracker.update(createCandidate(82.42, 0.88, nextTimestamp()));

    assert.equal(state.stage, "locked");
    assert.ok(Math.abs((state.trackedFrequencyHz ?? 0) - 82.41) < 0.05);
  });

  it("does not drop straight to lost on a single empty frame", () => {
    lockTracker();

    const state = tracker.update(createNullCandidate(nextTimestamp()));

    assert.notEqual(state.stage, "lost");
    assert.equal(state.mismatchCount, 1);
  });

  it("moves from locked to degraded before lost", () => {
    lockTracker();

    const firstMiss = tracker.update(createNullCandidate(nextTimestamp()));
    const secondMiss = tracker.update(createNullCandidate(nextTimestamp()));
    const thirdMiss = tracker.update(createNullCandidate(nextTimestamp()));
    const lost = tracker.update(createNullCandidate(nextTimestamp()));

    assert.equal(firstMiss.stage, "locked");
    assert.equal(secondMiss.stage, "degraded");
    assert.equal(thirdMiss.stage, "degraded");
    assert.equal(lost.stage, "lost");
  });

  it("recovers from degraded into tracking when continuity returns", () => {
    lockTracker();
    tracker.update(createNullCandidate(nextTimestamp()));
    tracker.update(createNullCandidate(nextTimestamp()));

    const recovered = tracker.update(createCandidate(82.4, 0.65, nextTimestamp()));

    assert.equal(recovered.stage, "tracking");
    assert.equal(recovered.mismatchCount, 0);
  });

  it("keeps continuity through low-clarity sustain instead of immediate loss", () => {
    lockTracker();

    const state = tracker.update(createCandidate(82.4, 0.55, nextTimestamp()));

    assert.notEqual(state.stage, "lost");
    assert.ok((state.trackedFrequencyHz ?? 0) > 82.3);
  });

  function lockTracker() {
    tracker.update(createCandidate(82.41, 0.86, nextTimestamp()));
    tracker.update(createCandidate(82.40, 0.87, nextTimestamp()));
    tracker.update(createCandidate(82.42, 0.88, nextTimestamp()));
  }

  function nextTimestamp() {
    timestampMs += 75;
    return timestampMs;
  }
});

function createCandidate(
  frequencyHz: number,
  clarity: number,
  timestampMs: number,
): RawPitchCandidate {
  return {
    frequencyHz,
    clarity,
    rms: 0.01,
    peak: 0.05,
    timestampMs,
    algorithm: "yin",
  };
}

function createNullCandidate(timestampMs: number): RawPitchCandidate {
  return {
    frequencyHz: null,
    clarity: 0,
    rms: 0.001,
    peak: 0.002,
    timestampMs,
    algorithm: "yin",
  };
}
