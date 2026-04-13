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

## 5. Batch Plan

### Batch 1

Quiet environment, six strings from `low E` to `high E`.

### Batch 2

Moderate-noise environment.

### Batch 3

Short-pluck focused checks.

### Batch 4

Optional `YIN` vs `autocorrelation` comparison review.

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

## 8. Stage Exit Check

Mark these after each validation round.

- [ ] first real-device pass completed for `low E` to `high E`
- [ ] noisy-environment behavior documented
- [ ] short-pluck behavior documented
- [ ] need for `autocorrelation` promotion decided
- [ ] next step toward "in-tune" closed-loop experience decided
