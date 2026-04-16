import test from "node:test";
import assert from "node:assert/strict";
import { ContinuousPitchTracker } from "../continuousPitchTracker";
import type { RawPitchCandidate } from "../../../types/pitchTracking";

function createCandidate(
  frequencyHz: number | null,
  clarity: number,
  timestampMs: number,
): RawPitchCandidate {
  return {
    frequencyHz,
    clarity,
    rms: frequencyHz === null ? 0.001 : 0.01,
    peak: frequencyHz === null ? 0.002 : 0.05,
    timestampMs,
    algorithm: "yin",
  };
}

test("tracker reaches locked only after consecutive stable frames", () => {
  const tracker = new ContinuousPitchTracker();

  const first = tracker.update(createCandidate(82.41, 0.85, 0));
  const second = tracker.update(createCandidate(82.4, 0.86, 75));
  const third = tracker.update(createCandidate(82.42, 0.87, 150));

  assert.equal(first.stage, "acquiring");
  assert.equal(second.stage, "acquiring");
  assert.equal(third.stage, "locked");
  assert.ok((third.trackedFrequencyHz ?? 0) > 82.3);
  assert.equal(third.mismatchCount, 0);
});

test("tracker degrades before it becomes lost", () => {
  const tracker = new ContinuousPitchTracker({ releaseAfterMisses: 8 });

  tracker.update(createCandidate(82.41, 0.85, 0));
  tracker.update(createCandidate(82.4, 0.86, 75));
  tracker.update(createCandidate(82.42, 0.87, 150));

  const held = tracker.update(createCandidate(null, 0, 225));
  tracker.update(createCandidate(null, 0, 300));
  tracker.update(createCandidate(null, 0, 375));
  const degraded = tracker.update(createCandidate(null, 0, 450));
  const degradedAgain = tracker.update(createCandidate(null, 0, 525));

  assert.equal(held.stage, "locked");
  assert.equal(degraded.stage, "degraded");
  assert.equal(degradedAgain.stage, "degraded");
  assert.ok(degradedAgain.mismatchCount >= 5);
});

test("tracker eventually reports lost after repeated misses", () => {
  const tracker = new ContinuousPitchTracker({ releaseAfterMisses: 8 });

  tracker.update(createCandidate(82.41, 0.85, 0));
  tracker.update(createCandidate(82.4, 0.86, 75));
  tracker.update(createCandidate(82.42, 0.87, 150));

  let state = tracker.getState();
  for (let index = 0; index < 8; index += 1) {
    state = tracker.update(createCandidate(null, 0, 225 + index * 75));
  }

  assert.equal(state.stage, "lost");
  assert.equal(state.holdRemainingMs, 0);
});

test("tracker can recover from degraded when pitch continuity returns", () => {
  const tracker = new ContinuousPitchTracker({ releaseAfterMisses: 8 });

  tracker.update(createCandidate(82.41, 0.85, 0));
  tracker.update(createCandidate(82.4, 0.86, 75));
  tracker.update(createCandidate(82.42, 0.87, 150));
  tracker.update(createCandidate(null, 0, 225));
  tracker.update(createCandidate(null, 0, 300));
  tracker.update(createCandidate(null, 0, 375));
  const degraded = tracker.update(createCandidate(null, 0, 450));
  const recovered = tracker.update(createCandidate(82.4, 0.7, 525));

  assert.equal(degraded.stage, "degraded");
  assert.equal(recovered.stage, "tracking");
  assert.equal(recovered.mismatchCount, 0);
  assert.ok(Math.abs((recovered.trackedFrequencyHz ?? 0) - 82.4) < 0.2);
});
