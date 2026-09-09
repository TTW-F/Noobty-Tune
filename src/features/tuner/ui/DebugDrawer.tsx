import type { DebugReadoutData } from "../../../components/DebugReadoutCard";
import { DebugReadoutCard } from "../../../components/DebugReadoutCard";
import { DeveloperLogConsole } from "../../../components/DeveloperLogConsole";
import { EnhancedDebugPanel } from "../../../components/EnhancedDebugPanel";
import type { DeveloperLogEntry } from "../../../lib/logging/developerLogger";
import type {
  PitchTrackingState,
  RawPitchCandidate,
  TuningInterpretation,
  TunerViewModel,
} from "../../../types/pitchTracking";

type DebugDrawerProps = {
  debugReadout: DebugReadoutData;
  developerLogs: readonly DeveloperLogEntry[];
  rawCandidate: RawPitchCandidate | null;
  trackingState: PitchTrackingState | null;
  interpretation: TuningInterpretation | null;
  viewModel: TunerViewModel;
};

/**
 * 开发者诊断:默认收起,不影响正式用户。
 */
export function DebugDrawer({
  debugReadout,
  developerLogs,
  rawCandidate,
  trackingState,
  interpretation,
  viewModel,
}: DebugDrawerProps) {
  return (
    <details className="dev-drawer">
      <summary>Developer diagnostics</summary>
      <div className="dev-drawer-body">
        <DebugReadoutCard data={debugReadout} />
        <EnhancedDebugPanel
          rawCandidate={rawCandidate}
          trackingState={trackingState}
          interpretation={interpretation}
          viewModel={viewModel}
          frameRms={debugReadout.frameRms}
        />
        <DeveloperLogConsole logs={developerLogs} />
      </div>
    </details>
  );
}
