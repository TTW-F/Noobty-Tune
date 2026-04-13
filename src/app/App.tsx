import { useDeveloperLogs } from "../lib/logging/developerLogger";
import { useTunerPrototype } from "../features/tuner/model";
import { TunerLandingScreen } from "../features/tuner/ui/TunerLandingScreen";

export function App() {
  const logs = useDeveloperLogs();
  const { state, detectorComparison, startTuning, resetSession, isStarting } = useTunerPrototype();
  const reading = state.stabilizedPitch ?? state.detectedPitch;
  const debugReadout = {
    audioStatus: state.audioStatus,
    frequencyHz: reading?.frequencyHz ?? null,
    noteLabel:
      reading?.noteName && typeof reading.octave === "number"
        ? `${reading.noteName}${reading.octave}`
        : null,
    cents: state.deviation?.cents ?? reading?.cents ?? null,
    targetLabel: state.activeTarget
      ? `${state.activeTarget.label} / ${state.activeTarget.note}${state.activeTarget.octave}`
      : state.selection.mode === "auto"
        ? "Auto"
        : state.selection.targetId,
    clarity: reading?.clarity ?? null,
    sampleCount: state.stabilizedPitch?.sampleCount ?? null,
    source: reading?.source ?? null,
    frameRms: detectorComparison.frameRms,
    primaryAlgorithm: detectorComparison.primaryAlgorithm,
    primaryFrequencyHz: detectorComparison.primaryFrequencyHz,
    primaryClarity: detectorComparison.primaryClarity,
    primaryNoteLabel: detectorComparison.primaryNoteLabel,
    secondaryAlgorithm: detectorComparison.secondaryAlgorithm,
    secondaryFrequencyHz: detectorComparison.secondaryFrequencyHz,
    secondaryClarity: detectorComparison.secondaryClarity,
    secondaryNoteLabel: detectorComparison.secondaryNoteLabel,
    detectorDeltaHz: detectorComparison.detectorDeltaHz,
  };

  return (
    <TunerLandingScreen
      state={state}
      isStarting={isStarting}
      onStart={startTuning}
      onReset={resetSession}
      debugReadout={debugReadout}
      developerLogs={logs}
    />
  );
}

export default App;
