# Tuner Completion Status

Date: 2026-04-17

This document records what has actually been implemented in the tuner refactor, what is intentionally still a compatibility layer, and what should still be validated on real devices.

## Delivery Summary

The refactor is functionally implemented for the core tuner pipeline:

`RawPitchCandidate -> PitchTrackingState -> TuningInterpretation -> TunerViewModel`

The current code now behaves as a continuous tracking tuner rather than a frame-by-frame detector with immediate reset semantics.

## Task Status

### Task 1: Continuous Pitch Tracker

Status: Implemented

Implemented in:

- `src/lib/audio/continuousPitchTracker.ts`
- `src/lib/audio/__tests__/continuousPitchTracker.test.ts`
- `docs/PITCH_TRACKER_CONFIG.md`

What is now true:

- A single empty frame does not immediately drop lock.
- The tracker progresses through `acquiring`, `tracking`, `locked`, `degraded`, and `lost`.
- Release is based on miss accumulation rather than an immediate reset.
- Hold time is tracked through `holdRemainingMs`.

### Task 2: Tuning Interpreter

Status: Implemented

Implemented in:

- `src/lib/music/tuningInterpreter.ts`
- `src/lib/music/__tests__/tuningInterpreter.test.ts`
- `docs/TUNING_INTERPRETER_CONTRACT.md`

What is now true:

- Auto mode does not bind a target during `acquiring` or `tracking`.
- Manual mode always uses the selected target when a tracked frequency exists.
- `detectedNote` and `targetId` are separate outputs.

### Task 3: Hook State Derivation Refactor

Status: Implemented with compatibility wrapper

Implemented in:

- `src/features/tuner/model/useTunerPrototype.ts`
- `src/features/tuner/model/tunerViewModel.ts`
- `src/features/tuner/ui/TunerDisplayAdapter.tsx`

What is now true:

- The hook derives UI-facing state from tracking and interpretation results.
- Legacy `TunerState` is still populated, but it is now derived from the new pipeline instead of being the primary source of truth.
- UI transitions no longer depend on a single detector frame being present.

Compatibility note:

- `TunerState`, `uiStatus`, `detectedPitch`, and `stabilizedPitch` still exist because the current screen and debug readout still consume that shape.
- This is a deliberate compatibility layer, not the core architecture.

### Task 4: Page Feedback Strategy

Status: Implemented

Implemented in:

- `src/features/tuner/ui/TunerLandingScreen.tsx`
- `src/features/tuner/ui/TunerDisplayAdapter.tsx`
- `docs/TUNER_UI_FEEDBACK_UX.md`

What is now true:

- Pre-lock states do not overstate target certainty.
- `degraded` explicitly means the tuner is still following the note but confidence is weakening.
- Success is shown only for locked, in-tune, high-confidence states.

### Task 5: Debugging and Observability

Status: Implemented

Implemented in:

- `src/components/EnhancedDebugPanel.tsx`
- `src/lib/logging/timeSeriesLogger.ts`
- `src/app/App.tsx`
- `docs/DEBUGGING.md`
- `docs/examples/pluck-session-log-sample.md`

What is now true:

- The debug panel exposes raw candidate frequency and clarity, tracker stage, tracker confidence, hold remaining, mismatch count, interpreted target, and cents offset.
- Structured time-series logging can be started, stopped, exported, and downloaded as CSV.
- Dev console access is exposed through `window.tunerDebug`.

### Task 6: Behavioral Test Refactor

Status: Implemented

Implemented in:

- `src/lib/audio/__tests__/continuousPitchTracker.test.ts`
- `src/lib/music/__tests__/tuningInterpreter.test.ts`
- `src/features/tuner/model/__tests__/tunerViewModel.test.ts`
- `src/__tests__/integration/tunerDataFlow.test.ts`

What is now true:

- Tracker behavior is covered at the state-machine level.
- Interpreter behavior is covered for auto and manual modes.
- End-to-end data flow is covered for the main state progression.

## Remaining Work

The project is not blocked, but these items are still worth doing:

- Real-device validation across low E through high E on at least one laptop mic and one phone mic.
- Threshold tuning based on recorded logs from real plucks.
- Optional cleanup of the remaining legacy `TunerState` compatibility shell once the UI fully consumes `viewModel` and tracking state directly.

## Non-Goals Still Preserved

The implementation still does not introduce any of the explicitly excluded scope:

- No `AudioWorklet`
- No alternate tuning support
- No new instrument families
- No large visual redesign
- No release pipeline rework

## Verification Snapshot

Verified on 2026-04-17:

- `npm test`
- `npm run test:typecheck`
- `npm run build`
