type DebugReadoutValue = string | number | null | undefined;

export type DebugReadoutData = {
  audioStatus?: string | null;
  frequencyHz?: number | null;
  noteLabel?: string | null;
  cents?: number | null;
  targetLabel?: string | null;
  clarity?: number | null;
  sampleCount?: number | null;
  source?: string | null;
  frameRms?: number | null;
  primaryAlgorithm?: string | null;
  primaryFrequencyHz?: number | null;
  primaryClarity?: number | null;
  primaryNoteLabel?: string | null;
  secondaryAlgorithm?: string | null;
  secondaryFrequencyHz?: number | null;
  secondaryClarity?: number | null;
  secondaryNoteLabel?: string | null;
  detectorDeltaHz?: number | null;
};

type DebugReadoutCardProps = {
  data: DebugReadoutData;
};

function formatFrequency(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  return `${value.toFixed(2)} Hz`;
}

function formatCents(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)} cent`;
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  return `${Math.round(value * 100)}%`;
}

function formatRms(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  return value.toFixed(4);
}

function formatCount(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  return `${Math.round(value)}`;
}

function formatText(value: DebugReadoutValue) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  return `${value}`;
}

export function DebugReadoutCard({ data }: DebugReadoutCardProps) {
  const liveItems = [
    { label: "Audio", value: formatText(data.audioStatus) },
    { label: "Freq", value: formatFrequency(data.frequencyHz) },
    { label: "Note", value: formatText(data.noteLabel) },
    { label: "Cents", value: formatCents(data.cents) },
    { label: "Target", value: formatText(data.targetLabel) },
    { label: "Clarity", value: formatPercent(data.clarity) },
    { label: "Samples", value: formatCount(data.sampleCount) },
    { label: "Source", value: formatText(data.source) },
  ];
  const comparisonItems = [
    { label: "Frame RMS", value: formatRms(data.frameRms) },
    {
      label: formatText(data.primaryAlgorithm).toUpperCase(),
      value: `${formatFrequency(data.primaryFrequencyHz)} / ${formatText(data.primaryNoteLabel)}`,
    },
    {
      label: `${formatText(data.primaryAlgorithm).toUpperCase()} clarity`,
      value: formatPercent(data.primaryClarity),
    },
    {
      label: formatText(data.secondaryAlgorithm).toUpperCase(),
      value: `${formatFrequency(data.secondaryFrequencyHz)} / ${formatText(data.secondaryNoteLabel)}`,
    },
    {
      label: `${formatText(data.secondaryAlgorithm).toUpperCase()} clarity`,
      value: formatPercent(data.secondaryClarity),
    },
    { label: "Delta", value: formatFrequency(data.detectorDeltaHz) },
  ];

  return (
    <section
      className="debug-readout-card"
      aria-labelledby="m2-debug-title"
      aria-live="polite"
    >
      <div className="debug-readout-header">
        <p className="debug-readout-kicker">M2 developer validation</p>
        <h2 id="m2-debug-title" className="debug-readout-title">
          Debug Readout
        </h2>
        <p className="debug-readout-description">
          Live frame diagnostics now show the primary YIN path alongside an
          autocorrelation comparison path for M2 device validation.
        </p>
      </div>

      <div className="debug-readout-sections">
        <div>
          <h3 className="debug-readout-section-title">Primary Tuner State</h3>
          <dl className="debug-readout-grid">
            {liveItems.map((item) => (
              <div key={item.label} className="debug-readout-item">
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <h3 className="debug-readout-section-title">Detector Comparison</h3>
          <dl className="debug-readout-grid">
            {comparisonItems.map((item) => (
              <div key={item.label} className="debug-readout-item">
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
