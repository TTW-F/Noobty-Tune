# Tuning Interpreter Contract

This document describes the runtime contract for `TuningInterpreter`.

Source:

- `src/lib/music/tuningInterpreter.ts`
- `src/lib/music/tuning.ts` (target set derivation)
- `src/types/pitchTracking.ts`

## Purpose

`TuningInterpreter` is the layer that turns tracking output into tuning semantics.

It does not decide whether a pitch candidate is stable enough to trust. That is the tracker's job.

It does not decide how the UI should look. That is the view model's job.

It is responsible for:

- deciding whether a target string should be assigned
- computing cents offset against a chosen target
- exposing the difference between the detected note and the chosen target

## Target Set

The interpreter owns no tuning knowledge. It is constructed with (or updated via
`setTargets` to) a resolved target list — the output of
`resolveTargets(tuning, referenceA4Hz)`:

```ts
const interpreter = new TuningInterpreter(resolveTargets(tuning));
```

- every target lookup (auto closest, manual by id) happens inside this list
- `setTargets(targets)` replaces the list and clears the sticky auto target —
  a new tuning has no "previous string"
- the module reads no global tuning table; what it sees is what it judges

## Input

### `PitchTrackingState`

Key fields used:

- `trackedFrequencyHz`
- `confidence`
- `stage`

### `TunerSelection`

- `tuningId`: which tuning is active (the caller resolves it into the target
  set injected above; the interpreter never reads it)
- `targetId`: the manual target within the active set

Supported modes:

- `auto`
- `manual`
- `chromatic`

## Output

`TuningInterpretation` contains:

- `detectedFrequencyHz`: the tracked frequency coming out of the tracker
- `detectedNote`: the note name closest to the tracked frequency
- `targetId`: the chosen target string within the active target set, or `null`
- `targetFrequencyHz`: the frequency of the chosen target, or `null`
- `centsOffset`: cents deviation from the chosen target, or `null`
- `direction`: `flat`, `sharp`, `in-tune`, or `unknown`
- `confidence`: tracking confidence passed through from the tracker
- `trackingStage`: the current tracking stage passed through from the tracker

## Mode Rules

### Auto Mode

Behavior:

- `idle` and `lost`: no interpretation target is assigned
- `acquiring`: no target is assigned
- `tracking`: no target is assigned yet
- `locked` and `degraded`: the closest target of the active target set is assigned

Target stickiness (hysteresis):

- once a target has been assigned, the interpreter keeps it until another string
  is closer by more than 15 cents (`TARGET_SWITCH_MARGIN_CENTS`)
- without this margin, a tracked pitch sitting near the midpoint between two
  open strings flips targets from frame to frame and the tuning needle jumps
- `idle` and `lost` clear the sticky target; `reset()` clears it manually
- `setTargets()` clears it as part of switching tunings
- manual mode is unaffected and never reads or writes the sticky target

Why:

- `acquiring` and `tracking` are intentionally honest states
- the tuner may be following a note, but it should not overstate certainty about the target string too early
- once a target IS assigned, switching it should require a deliberate pitch move, not jitter

### Manual Mode

Behavior:

- when a frequency exists, the selected target is always used
- a selected target that the active target set does not contain yields no
  interpretation target (empty output)
- the detected note and the target can differ
- the cents value is still computed against the selected target

Why:

- manual mode is an explicit user override

### Chromatic Mode

Behavior:

- no string attribution: `targetId` is always `null`
- the nearest chromatic note acts as the reference; `targetFrequencyHz` carries
  that note's frequency and `centsOffset` is measured against it
- cents are computed as soon as a frequency exists (including `acquiring` and
  `tracking`) — there is no target-assignment honesty problem to defer
- the sticky target is never read or written inside chromatic mode; a chromatic
  detour therefore leaves the previous auto attribution intact, and returning
  to `auto` resumes it — the sticky still yields to any decisively closer
  string through the normal hysteresis margin, so the needle stays stable
  across the mode round-trip

Why:

- chromatic mode answers "don't assume my tuning": the user wants a note name
  and a cents deviation, not a judgment against a string table

## Semantic Separation

The interpreter must keep these concepts separate:

- `detectedNote`: what the tracker believes the note currently is
- `targetId`: what string the tuner is judging against

Example:

- detected frequency: `110 Hz`
- detected note: `A2`
- manual target: `string-6`
- target frequency: `82.41 Hz`

This is valid. The tuner should not rewrite the detected note into the target note.

## Example Outputs

### Auto mode during acquiring

```ts
{
  detectedFrequencyHz: 82.41,
  detectedNote: "E2",
  targetId: null,
  targetFrequencyHz: null,
  centsOffset: null,
  direction: "unknown",
  confidence: 0.84,
  trackingStage: "acquiring"
}
```

### Auto mode after lock

```ts
{
  detectedFrequencyHz: 82.50,
  detectedNote: "E2",
  targetId: "string-6",
  targetFrequencyHz: 82.41,
  centsOffset: 1.9,
  direction: "in-tune",
  confidence: 0.89,
  trackingStage: "locked"
}
```

### Manual mode with mismatched detected note

```ts
{
  detectedFrequencyHz: 110.0,
  detectedNote: "A2",
  targetId: "string-6",
  targetFrequencyHz: 82.41,
  centsOffset: 499.5,
  direction: "sharp",
  confidence: 0.85,
  trackingStage: "tracking"
}
```

## Validation References

- `src/lib/music/__tests__/tuningInterpreter.test.ts`
- `src/__tests__/integration/tunerDataFlow.test.ts`
