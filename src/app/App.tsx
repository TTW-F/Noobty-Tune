import { useEffect } from "react";
import { useDeveloperLogs } from "../lib/logging/developerLogger";
import { useTunerPrototype } from "../features/tuner/model";
import { TunerLandingScreen } from "../features/tuner/ui/TunerLandingScreen";

export function App() {
  const logs = useDeveloperLogs();
  const {
    state,
    rawCandidate,
    trackingState,
    interpretation,
    viewModel,
    detectorComparison,
    availableInputs,
    selectedInputDeviceId,
    activeInputLabel,
    startTuning,
    resetSession,
    refreshInputDevices,
    selectInputDevice,
    enableAutoTargetMode,
    selectManualTarget,
    isStarting,
    debugLogger,
  } = useTunerPrototype();
  
  // 暴露调试工具到全局（仅开发环境）
  useEffect(() => {
    if (typeof window !== "undefined" && import.meta.env.DEV) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).tunerDebug = debugLogger;
    }
  }, [debugLogger]);

  const reading = trackingState?.trackedFrequencyHz
    ? state.stabilizedPitch
    : state.detectedPitch;
  const debugReadout = {
    audioStatus: state.audioStatus,
    frequencyHz: trackingState?.trackedFrequencyHz ?? rawCandidate?.frequencyHz ?? null,
    noteLabel: interpretation?.detectedNote ?? null,
    cents: interpretation?.centsOffset ?? null,
    targetLabel: viewModel.displayTarget
      ? viewModel.displayTarget
      : state.activeTarget
        ? `${state.activeTarget.label} / ${state.activeTarget.note}${state.activeTarget.octave}`
        : state.selection.mode === "auto"
          ? "Auto"
          : state.selection.targetId,
    clarity: trackingState?.confidence ?? rawCandidate?.clarity ?? null,
    sampleCount: trackingState?.stage === "locked" ? 3 : null,
    source: reading?.source ?? (rawCandidate?.frequencyHz ? "microphone" : null),
    frameRms: detectorComparison.frameRms,
    primaryAlgorithm: detectorComparison.primaryAlgorithm,
    primaryFrequencyHz: detectorComparison.primaryFrequencyHz,
    primaryClarity: detectorComparison.primaryClarity,
    primaryNoteLabel: interpretation?.detectedNote ?? detectorComparison.primaryNoteLabel,
    secondaryAlgorithm: detectorComparison.secondaryAlgorithm,
    secondaryFrequencyHz: detectorComparison.secondaryFrequencyHz,
    secondaryClarity: detectorComparison.secondaryClarity,
    secondaryNoteLabel: detectorComparison.secondaryNoteLabel,
    detectorDeltaHz: detectorComparison.detectorDeltaHz,
  };

  return (
    <TunerLandingScreen
      state={state}
      rawCandidate={rawCandidate}
      trackingState={trackingState}
      interpretation={interpretation}
      viewModel={viewModel}
      isStarting={isStarting}
      onStart={startTuning}
      onReset={resetSession}
      debugReadout={debugReadout}
      developerLogs={logs}
      availableInputs={availableInputs}
      selectedInputDeviceId={selectedInputDeviceId}
      activeInputLabel={activeInputLabel}
      onRefreshInputs={refreshInputDevices}
      onSelectInput={selectInputDevice}
      onEnableAutoTargetMode={enableAutoTargetMode}
      onSelectManualTarget={selectManualTarget}
    />
  );
}

export default App;
