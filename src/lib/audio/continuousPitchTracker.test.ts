import test from "node:test";
import assert from "node:assert/strict";
import type { RawPitchCandidate } from "../../types/pitchTracking";
import { ContinuousPitchTracker } from "./continuousPitchTracker";

function createCandidate(
  frequencyHz: number | null,
  clarity: number,
  timestampMs: number,
): RawPitchCandidate {
  return {
    frequencyHz,
    clarity,
    rms: frequencyHz === null ? 0 : 0.01,
    peak: frequencyHz === null ? 0 : 0.05,
    timestampMs,
    algorithm: "yin",
  };
}

test("tracker persists state across frames and reaches locked", () => {
  const tracker = new ContinuousPitchTracker({
    lockRequiredFrames: 3,
    lockClarityThreshold: 0.8,
  });

  const first = tracker.update(createCandidate(82.4, 0.9, 0));
  const second = tracker.update(createCandidate(82.5, 0.9, 75));
  const third = tracker.update(createCandidate(82.45, 0.9, 150));

  assert.equal(first.stage, "acquiring");
  assert.equal(second.stage, "acquiring");
  assert.equal(third.stage, "locked");
  assert.equal(tracker.getState().stage, "locked");
});

test("tracker degrades before it is lost", () => {
  const tracker = new ContinuousPitchTracker({
    lockRequiredFrames: 2,
    lockClarityThreshold: 0.8,
    releaseAfterMisses: 4,
  });

  tracker.update(createCandidate(82.4, 0.9, 0));
  tracker.update(createCandidate(82.45, 0.9, 75));

  const held = tracker.update(createCandidate(null, 0, 150));
  const degraded = tracker.update(createCandidate(null, 0, 225));
  const stillDegraded = tracker.update(createCandidate(null, 0, 300));
  const lost = tracker.update(createCandidate(null, 0, 375));

  assert.equal(held.stage, "locked");
  assert.equal(degraded.stage, "degraded");
  assert.equal(stillDegraded.stage, "degraded");
  assert.equal(lost.stage, "lost");
});
