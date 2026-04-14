# V1 Delivery Classification (2026-04-14)

## Purpose

This document classifies the current implementation into three buckets:

- `V1 baseline`
- `V1.1 candidate / out-of-baseline`
- `Not yet validated / not yet complete`

It is intended to support planning, review, and acceptance.

## References

- `docs/adr/0001-web-v1-scope.md`
- `docs/adr/0004-yin-as-default-pitch-detection-candidate.md`
- `docs/adr/0005-auto-target-string-for-v1.md`
- `docs/development/v1-scope-deviation-note-2026-04-14.md`

## V1 Baseline

These items are inside the original Web V1 delivery target.

- Standard six-string guitar target set: `E2 A2 D3 G3 B3 E4`
- Browser-local microphone capture
- Permission request and rejection handling
- Real-time single-note pitch detection
- YIN as the default pitch-detection route
- Automatic closest-string target resolution
- Cents deviation and `flat / sharp / in-tune` feedback
- Basic stabilization before declaring stable tuning feedback
- Reasonable UI feedback for permission failure, weak input, and no clear pitch

## V1.1 Candidate / Out-of-Baseline

These items exist in the current branch, but should not be used as V1 acceptance criteria.

- Manual target-string selection
- `Auto / Manual` target mode switching in the main UI
- Manual target hint participation in stabilization logic

Practical rule:

- If an issue exists only in manual mode and does not affect shared core logic, it should be triaged as post-V1.

## Not Yet Validated / Not Yet Complete

These items still block confident V1 sign-off.

- Real-device validation from low E to high E
- Threshold tuning based on actual test results
- Verification of weak-signal, noisy-room, and short-pluck scenarios
- Decision on whether autocorrelation remains only diagnostic or needs further action
- M3 core-loop completion judgment
- M4 usability readiness judgment
- M5 release-candidate readiness judgment

## Current Team Guidance

Until V1 sign-off:

- prioritize the automatic tuning path first
- do not expand manual mode further without an explicit scope decision
- treat documentation and test evidence as part of the deliverable
- measure progress by validation closure, not by adding new controls

## Suggested Next Work Order

1. Finish real-device validation logs.
2. Tune thresholds and stabilization using those results.
3. Close the V1 automatic-flow usability and failure-state review.
4. Decide whether manual mode stays visible, hidden, or deferred in the release path.
