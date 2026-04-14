# M2 Real-Device Validation Log

## 1. Goal

This document is the execution log and reusable template for the Web tuner `M2` validation stage.

It exists to support:

- real-device verification from `low E` to `high E`
- noisy-environment checks
- short-pluck vs sustain checks
- optional `YIN` vs `autocorrelation` comparison
- parameter tuning decisions for detector and stabilizer thresholds

## 2. Related Docs

- `docs/development/test-plan-web-v1.md`
- `docs/development/milestones-web-v1.md`
- `docs/development/technical-design-web-v1.md`

Suggested test-plan mapping:

- `TC-05` standard six-string detection
- `TC-06` low `E` focused validation
- `TC-07` high `E` validation
- `TC-11` noisy environment
- `TC-13` short pluck

## 3. Validation Scope

Current M2 validation should cover:

- `E2 A2 D3 G3 B3 E4`
- quiet room and moderate-noise room
- short pluck and sustain
- primary path: `YIN + stabilizer`
- debug comparison path: `autocorrelation`

## 3.1 Acceptance Focus For M2

This stage should prioritize the `V1 baseline` automatic-target flow.

Do not block M2 on:

- manual target-string mode
- manual-mode-only UI issues
- post-V1 tuning workflow enhancements

Reference:

- `docs/development/v1-delivery-classification-2026-04-14.md`

## 3.2 Run Priority

Use this order unless there is a specific blocker:

1. Quiet room, sustain, `E2 -> E4`
2. Quiet room, short pluck, `E2 -> E4`
3. Moderate noise, sustain, `E2 -> E4`
4. Focused re-runs for strings or scenarios that failed

## 3.3 Pass / Needs Tuning / Fail

Use the result labels consistently:

- `pass`
  - correct string mapping observed
  - no octave error
  - stable convergence reached in a reasonable time for the scenario
  - cents jitter is acceptable for the scenario
- `needs tuning`
  - generally usable, but convergence is slow, jittery, or inconsistent
  - no hard blocker, but thresholds or stabilizer settings likely need adjustment
- `fail`
  - wrong string mapping
  - octave error
  - no stable convergence in a scenario that should be supported
  - behavior is confusing enough to block normal use

## 4. Run Template

Copy this block for each validation run.

```md
### Run ID

- Date:
- Build / commit:
- Device:
- Browser:
- Environment: `localhost` / `https`
- Noise level: `quiet` / `moderate`
- String: `E2` / `A2` / `D3` / `G3` / `B3` / `E4`
- Pluck type: `short pluck` / `sustain`
- Primary algorithm: `YIN + stabilizer`
- Comparison algorithm: `autocorrelation`
- First visible detection latency:
- Stable convergence latency:
- Correct target string: `yes` / `no`
- Visible cents jitter: `low` / `medium` / `high`
- Octave error observed: `yes` / `no`
- Wrong-string mapping observed: `yes` / `no`
- Result: `pass` / `needs tuning` / `fail`
- Notes:
- Recording / screenshot:
```

## 4.1 Recommended Notes Format

Keep the `Notes` field compact and decision-oriented:

- what happened
- whether it is repeatable
- whether it looks like detector, stabilizer, target mapping, or UI feedback

Example:

```md
- Low E mapped correctly after second pluck.
- Stable lock took ~1.6s, slightly slower than expected.
- Jitter remained visible near the center line.
- Likely stabilizer-threshold tuning issue, not a wrong-string issue.
```

## 5. Batch Plan

### Batch 1

Quiet environment, six strings from `low E` to `high E`.

### Batch 2

Moderate-noise environment.

### Batch 3

Short-pluck focused checks.

### Batch 4

Optional `YIN` vs `autocorrelation` comparison review.

## 5.1 Minimum M2 Completion Set

Before calling M2 "first-pass validated", make sure there is at least:

- one quiet sustain run for all six strings
- one quiet short-pluck run for all six strings
- one moderate-noise sustain run for `E2`, `A2`, and `E4`
- one explicit conclusion on whether `autocorrelation` remains diagnostic-only

## 6. Summary Table

Use this table to keep the latest overall status visible.

| String | Quiet sustain | Quiet short pluck | Noise sustain | Main issue | Status |
| --- | --- | --- | --- | --- | --- |
| E2 | pending | pending | pending | - | pending |
| A2 | pending | pending | pending | - | pending |
| D3 | pending | pending | pending | - | pending |
| G3 | pending | pending | pending | - | pending |
| B3 | pending | pending | pending | - | pending |
| E4 | pending | pending | pending | - | pending |

## 7. Parameter Tuning Notes

Record every tuning decision here before changing code.

```md
### Tuning Note

- Date:
- Trigger:
- Observed issue:
- Planned change:
- Files:
- Expected effect:
- Validation follow-up:
```

## 7.1 Tuning Decision Rules

Do not change thresholds after a single weak run.

A tuning change should usually require one of these:

- the same issue repeats across multiple runs on the same string
- the same issue appears across multiple strings
- the issue is severe enough to count as a clear blocker

When a tuning change is made, always record:

- what metric or symptom triggered the change
- which scenario should improve
- which regression risk should be watched next

## 8. Round Summary Template

Copy this after each validation batch.

```md
### Validation Round Summary

- Date:
- Batch:
- Scope covered:
- Main passes:
- Main failures:
- Strings needing re-run:
- Recommended code/config change:
- Can M2 continue without change: `yes` / `no`
- Next validation step:
```

## 8. Stage Exit Check

Mark these after each validation round.

- [ ] first real-device pass completed for `low E` to `high E`
- [ ] noisy-environment behavior documented
- [ ] short-pluck behavior documented
- [ ] need for `autocorrelation` promotion decided
- [ ] next step toward "in-tune" closed-loop experience decided

## 9. Exit Decision

At the end of the current M2 round, record one explicit decision:

- `M2 still in progress`
- `M2 first-pass complete, move to M3 closure work`
- `M2 blocked, redesign or detector strategy review required`
