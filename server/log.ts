// Minimal level-gated logger for the Bun server and agent adapters.
//
// Output goes to stdout (info/debug) or stderr (warn/error) with a fixed
// `HH:MM:SS.mmm LEVEL [tag] message` shape so log lines stay greppable.
// Set `VELLUM_LOG` to `debug` / `info` / `warn` / `error` to change the
// threshold; default is `info`.

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Readonly<Record<Level, number>> = { debug: 0, info: 1, warn: 2, error: 3 };

function configuredLevel(): Level {
  const raw = (Bun.env.VELLUM_LOG ?? "info").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") return raw;
  return "info";
}

const MIN_RANK = LEVEL_RANK[configuredLevel()];

function timestamp(): string {
  return new Date().toISOString().slice(11, 23);
}

function emit(level: Level, tag: string, message: string): void {
  if (LEVEL_RANK[level] < MIN_RANK) return;
  const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
  stream.write(`${timestamp()} ${level.padEnd(5)} [${tag}] ${message}\n`);
}

export const log = {
  debug(tag: string, message: string): void {
    emit("debug", tag, message);
  },
  info(tag: string, message: string): void {
    emit("info", tag, message);
  },
  warn(tag: string, message: string): void {
    emit("warn", tag, message);
  },
  error(tag: string, message: string): void {
    emit("error", tag, message);
  },
};

export function truncate(text: string, max = 80): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}
