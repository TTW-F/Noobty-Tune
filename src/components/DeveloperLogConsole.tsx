import {
  clearDeveloperLogs,
  type DeveloperLogEntry,
  type DeveloperLogLevel,
  type DeveloperLogMetaValue,
} from "../lib/logging/developerLogger";

type DeveloperLogConsoleProps = {
  logs: readonly DeveloperLogEntry[];
};

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  }).format(timestamp);
}

function countByLevel(logs: readonly DeveloperLogEntry[], level: DeveloperLogLevel) {
  return logs.filter((entry) => entry.level === level).length;
}

function formatMetaValue(value: DeveloperLogMetaValue) {
  if (value === null) {
    return "null";
  }

  return `${value}`;
}

export function DeveloperLogConsole({ logs }: DeveloperLogConsoleProps) {
  const recentLogs = [...logs].reverse().slice(0, 24);

  return (
    <section className="developer-log-console" aria-labelledby="developer-log-title">
      <div className="developer-log-header">
        <div>
          <p className="developer-log-kicker">Dev observability</p>
          <h2 id="developer-log-title" className="developer-log-title">
            Developer Log Console
          </h2>
          <p className="developer-log-description">
            Live timeline for permission flow, audio frames, detector decisions, and failures.
          </p>
        </div>

        <button type="button" className="developer-log-clear" onClick={() => clearDeveloperLogs()}>
          Clear logs
        </button>
      </div>

      <div className="developer-log-summary" aria-label="log summary">
        <div className="developer-log-stat">
          <dt>Total</dt>
          <dd>{logs.length}</dd>
        </div>
        <div className="developer-log-stat">
          <dt>Error</dt>
          <dd>{countByLevel(logs, "error")}</dd>
        </div>
        <div className="developer-log-stat">
          <dt>Warn</dt>
          <dd>{countByLevel(logs, "warn")}</dd>
        </div>
        <div className="developer-log-stat">
          <dt>Success</dt>
          <dd>{countByLevel(logs, "success")}</dd>
        </div>
      </div>

      <div className="developer-log-stream" role="log" aria-live="polite" aria-relevant="additions text">
        {recentLogs.length === 0 ? (
          <p className="developer-log-empty">No logs yet. Start tuning to begin the timeline.</p>
        ) : (
          recentLogs.map((entry) => (
            <article
              key={entry.id}
              className={`developer-log-entry developer-log-entry--${entry.level}`}
            >
              <div className="developer-log-entry-head">
                <span className={`developer-log-badge developer-log-badge--${entry.level}`}>
                  {entry.level.toUpperCase()}
                </span>
                <span className="developer-log-scope">{entry.scope}</span>
                <time className="developer-log-time">{formatTimestamp(entry.ts)}</time>
              </div>
              <h3 className="developer-log-entry-title">{entry.title}</h3>
              <p className="developer-log-entry-message">{entry.message}</p>
              {entry.meta && Object.keys(entry.meta).length > 0 ? (
                <dl className="developer-log-meta">
                  {Object.entries(entry.meta).map(([key, value]) => (
                    <div key={key} className="developer-log-meta-item">
                      <dt>{key}</dt>
                      <dd>{formatMetaValue(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
