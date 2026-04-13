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
  const items = [
    { label: "Audio", value: formatText(data.audioStatus) },
    { label: "Freq", value: formatFrequency(data.frequencyHz) },
    { label: "Note", value: formatText(data.noteLabel) },
    { label: "Cents", value: formatCents(data.cents) },
    { label: "Target", value: formatText(data.targetLabel) },
    { label: "Clarity", value: formatPercent(data.clarity) },
    { label: "Samples", value: formatCount(data.sampleCount) },
    { label: "Source", value: formatText(data.source) },
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
          The panel stays lightweight now and is ready for live detection data
          once the main thread wires it in.
        </p>
      </div>

      <dl className="debug-readout-grid">
        {items.map((item) => (
          <div key={item.label} className="debug-readout-item">
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
