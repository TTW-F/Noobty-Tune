# V1 Scope Deviation Note (2026-04-14)

## Status

Accepted as a branch-level implementation note.

This note does not replace existing ADR decisions.
It records that the current working branch contains one user-visible capability
that goes beyond the original Web V1 scope baseline.

## Related ADRs

- `docs/adr/0001-web-v1-scope.md`
- `docs/adr/0004-yin-as-default-pitch-detection-candidate.md`
- `docs/adr/0005-auto-target-string-for-v1.md`

## Summary

The project is still treated as `Web V1 / M2 in progress`.

Most recent implementation work remains inside the intended V1 delivery path:

- browser-local microphone capture
- YIN-first pitch detection
- automatic target-string matching
- stabilization and cents deviation feedback
- device fallback and improved microphone error handling
- clearer weak-signal / no-clear-pitch UI feedback

However, the current branch also contains a scope deviation:

- `manual target string selection` is implemented in UI, state, and stabilizer logic

This capability should be treated as a `V1.1 candidate` or experimental branch capability.
It is not part of the original V1 acceptance baseline.

## Why This Is A Deviation

ADR 0005 states that Web V1 defaults to automatic target-string matching and does
not require manual string locking as part of the V1 product definition.

The current branch goes further than "design space reserved for later":

- the UI exposes `Auto / Manual` target mode switching
- the state model supports `auto | manual`
- manual selection influences the active target and pitch stabilization path

That means the branch is no longer only preserving future extensibility.
It is carrying an actual post-V1 feature candidate.

## Decision For This Branch

We will keep the current implementation in the branch.

But for planning, review, and acceptance purposes:

- `manual target string selection` is classified as out-of-baseline for V1
- V1 completion must not depend on manual mode
- V1 validation should continue to focus on the automatic-target flow
- any defects found only in manual mode should be triaged as post-V1 unless they affect shared core logic

## What Still Defines V1 Completion

The following remain the primary V1 completion criteria:

- real-device validation from low E to high E
- threshold and stabilization tuning based on test results
- confirmation that the automatic-target main flow is understandable and usable
- handling of microphone permission failure, weak input, and noisy input in a reasonable way

## Current Practical Guidance

When making implementation decisions on this branch:

- prefer work that improves the automatic tuning path first
- treat manual mode as secondary and non-blocking
- avoid expanding manual mode further unless there is an explicit product decision
- do not let manual-mode requirements redefine V1 architecture or acceptance scope

## Follow-up

Before V1 sign-off, we should choose one of these paths explicitly:

1. Keep manual mode in the codebase but exclude it from V1 acceptance.
2. Hide manual mode from the primary UI and keep it as an internal experiment.
3. Promote manual mode into an updated product scope with a new ADR or scope revision.
