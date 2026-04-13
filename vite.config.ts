import { inspect } from "node:util";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

type DevLogPayload = {
  readonly ts?: number;
  readonly level?: string;
  readonly scope?: string;
  readonly title?: string;
  readonly message?: string;
  readonly meta?: Record<string, unknown>;
};

function color(code: number, text: string) {
  return `\u001b[${code}m${text}\u001b[0m`;
}

function getLevelColor(level: string) {
  switch (level) {
    case "error":
      return 31;
    case "warn":
      return 33;
    case "success":
      return 32;
    case "info":
      return 36;
    case "debug":
      return 35;
    default:
      return 90;
  }
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  }).format(timestamp);
}

function printDevLog(payload: DevLogPayload) {
  const timestamp = payload.ts ?? Date.now();
  const level = (payload.level ?? "info").toLowerCase();
  const scope = payload.scope ?? "app";
  const title = payload.title ?? "event";
  const message = payload.message ?? "";
  const meta = payload.meta ?? {};

  const summary = [
    color(90, formatTime(timestamp)),
    color(getLevelColor(level), level.toUpperCase().padEnd(7, " ")),
    color(94, scope.padEnd(12, " ")),
    color(97, title),
  ].join("  ");

  console.log(summary);
  if (message) {
    console.log(`  ${message}`);
  }

  if (Object.keys(meta).length > 0) {
    const details = inspect(meta, {
      colors: true,
      depth: 4,
      compact: false,
      sorted: true,
    })
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n");

    console.log(color(90, "  meta"));
    console.log(details);
  }

  console.log(color(90, "  " + "-".repeat(60)));
}

function devLogRelayPlugin(): Plugin {
  return {
    name: "dev-log-relay",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__dev/log", (request, response) => {
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.end("Method Not Allowed");
          return;
        }

        const chunks: Uint8Array[] = [];

        request.on("data", (chunk) => {
          chunks.push(chunk);
        });

        request.on("end", () => {
          try {
            const rawBody = Buffer.concat(chunks).toString("utf8");
            const payload = JSON.parse(rawBody) as DevLogPayload;
            printDevLog(payload);
            response.statusCode = 204;
            response.end();
          } catch (error) {
            console.error(color(31, "[dev-log-relay] Failed to parse browser log payload"));
            console.error(error);
            response.statusCode = 400;
            response.end("Invalid log payload");
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devLogRelayPlugin()],
});
