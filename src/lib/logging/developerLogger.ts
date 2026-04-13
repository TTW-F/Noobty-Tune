import { useSyncExternalStore } from "react";

export type DeveloperLogLevel = "trace" | "debug" | "info" | "success" | "warn" | "error";

export type DeveloperLogScope =
  | "app"
  | "permission"
  | "audio"
  | "frame"
  | "detector"
  | "stabilizer"
  | "ui"
  | "network";

export type DeveloperLogMetaValue = string | number | boolean | null;

export type DeveloperLogEntry = {
  readonly id: string;
  readonly ts: number;
  readonly level: DeveloperLogLevel;
  readonly scope: DeveloperLogScope;
  readonly title: string;
  readonly message: string;
  readonly meta?: Record<string, DeveloperLogMetaValue>;
};

type DeveloperLogOptions = {
  readonly meta?: Record<string, DeveloperLogMetaValue>;
  readonly throttleKey?: string;
  readonly throttleMs?: number;
};

type DevLogPayload = {
  readonly ts: number;
  readonly level: DeveloperLogLevel;
  readonly scope: DeveloperLogScope;
  readonly title: string;
  readonly message: string;
  readonly meta?: Record<string, DeveloperLogMetaValue>;
};

type Listener = () => void;

const MAX_LOG_ENTRIES = 180;
const logs: DeveloperLogEntry[] = [];
const listeners = new Set<Listener>();
const throttleState = new Map<string, number>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function pushLog(entry: DeveloperLogEntry) {
  logs.push(entry);
  if (logs.length > MAX_LOG_ENTRIES) {
    logs.splice(0, logs.length - MAX_LOG_ENTRIES);
  }
  notifyListeners();
}

function shouldThrottle(key: string | undefined, throttleMs: number | undefined, now: number) {
  if (!key || !throttleMs || throttleMs <= 0) {
    return false;
  }

  const lastTimestamp = throttleState.get(key) ?? 0;
  if (now - lastTimestamp < throttleMs) {
    return true;
  }

  throttleState.set(key, now);
  return false;
}

function formatLogTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  }).format(timestamp);
}

function getConsoleStyle(level: DeveloperLogLevel) {
  switch (level) {
    case "error":
      return "background:#7f1d1d;color:#fee2e2;padding:2px 8px;border-radius:999px;font-weight:700;";
    case "warn":
      return "background:#78350f;color:#fef3c7;padding:2px 8px;border-radius:999px;font-weight:700;";
    case "success":
      return "background:#14532d;color:#dcfce7;padding:2px 8px;border-radius:999px;font-weight:700;";
    case "info":
      return "background:#1d4ed8;color:#dbeafe;padding:2px 8px;border-radius:999px;font-weight:700;";
    case "debug":
      return "background:#334155;color:#e2e8f0;padding:2px 8px;border-radius:999px;font-weight:700;";
    default:
      return "background:#475569;color:#f8fafc;padding:2px 8px;border-radius:999px;font-weight:700;";
  }
}

function printToBrowserConsole(entry: DeveloperLogEntry) {
  const time = formatLogTime(entry.ts);
  const tag = `${entry.scope.toUpperCase()} ${entry.level.toUpperCase()}`;
  const meta = entry.meta ?? {};

  console.log(
    `%c${tag}%c ${time} ${entry.title}`,
    getConsoleStyle(entry.level),
    "color:#0f172a;font-weight:700;",
  );
  console.log(entry.message);
  if (Object.keys(meta).length > 0) {
    console.table(meta);
  }
}

function relayToDevServer(payload: DevLogPayload) {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return;
  }

  const body = JSON.stringify(payload);

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/__dev/log", blob);
    return;
  }

  void fetch("/__dev/log", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    keepalive: true,
  }).catch(() => {
    // Dev relay failures should never interrupt tuning.
  });
}

function createEntry(
  scope: DeveloperLogScope,
  level: DeveloperLogLevel,
  title: string,
  message: string,
  options: DeveloperLogOptions = {},
): DeveloperLogEntry | null {
  const now = Date.now();

  if (shouldThrottle(options.throttleKey, options.throttleMs, now)) {
    return null;
  }

  return {
    id: `${now}-${Math.random().toString(16).slice(2, 8)}`,
    ts: now,
    level,
    scope,
    title,
    message,
    meta: options.meta,
  };
}

export function logDeveloperEvent(
  scope: DeveloperLogScope,
  level: DeveloperLogLevel,
  title: string,
  message: string,
  options: DeveloperLogOptions = {},
) {
  const entry = createEntry(scope, level, title, message, options);
  if (!entry) {
    return;
  }

  pushLog(entry);
  printToBrowserConsole(entry);
  relayToDevServer({
    ts: entry.ts,
    level: entry.level,
    scope: entry.scope,
    title: entry.title,
    message: entry.message,
    meta: entry.meta,
  });
}

export function createScopedLogger(scope: DeveloperLogScope) {
  return {
    trace(title: string, message: string, options?: DeveloperLogOptions) {
      logDeveloperEvent(scope, "trace", title, message, options);
    },
    debug(title: string, message: string, options?: DeveloperLogOptions) {
      logDeveloperEvent(scope, "debug", title, message, options);
    },
    info(title: string, message: string, options?: DeveloperLogOptions) {
      logDeveloperEvent(scope, "info", title, message, options);
    },
    success(title: string, message: string, options?: DeveloperLogOptions) {
      logDeveloperEvent(scope, "success", title, message, options);
    },
    warn(title: string, message: string, options?: DeveloperLogOptions) {
      logDeveloperEvent(scope, "warn", title, message, options);
    },
    error(title: string, message: string, options?: DeveloperLogOptions) {
      logDeveloperEvent(scope, "error", title, message, options);
    },
  };
}

export function clearDeveloperLogs() {
  logs.splice(0, logs.length);
  notifyListeners();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return logs;
}

export function useDeveloperLogs() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
