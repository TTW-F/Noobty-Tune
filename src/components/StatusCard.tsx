type StatusTone = "neutral" | "info" | "warning" | "error";

type StatusCardProps = {
  label: string;
  title: string;
  description: string;
  tone?: StatusTone;
  hint?: string;
};

export function StatusCard({
  label,
  title,
  description,
  tone = "neutral",
  hint,
}: StatusCardProps) {
  return (
    <section
      className={`status-card status-card--${tone}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="status-label">{label}</p>
      <h2 className="status-title">{title}</h2>
      <p className="status-description">{description}</p>
      {hint ? <p className="status-hint">{hint}</p> : null}
    </section>
  );
}
