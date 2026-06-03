export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  [key: string]: unknown;
}

export interface StructuredLoggerOptions {
  service: string;
  minLevel?: LogLevel;
  sink?: (line: string) => void;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Emits one JSON object per log line for ingestion by Loki, CloudWatch, or similar.
 */
export class StructuredLogger {
  private readonly minLevel: LogLevel;

  constructor(private readonly options: StructuredLoggerOptions) {
    this.minLevel = options.minLevel ?? (process.env.LOG_LEVEL as LogLevel) ?? "info";
  }

  debug(message: string, fields?: Record<string, unknown>): void {
    this.emit("debug", message, fields);
  }

  info(message: string, fields?: Record<string, unknown>): void {
    this.emit("info", message, fields);
  }

  warn(message: string, fields?: Record<string, unknown>): void {
    this.emit("warn", message, fields);
  }

  error(message: string, fields?: Record<string, unknown>): void {
    this.emit("error", message, fields);
  }

  format(level: LogLevel, message: string, fields?: Record<string, unknown>): LogRecord {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.options.service,
      ...fields,
    };
  }

  private emit(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) {
      return;
    }
    const record = this.format(level, message, fields);
    const line = JSON.stringify(record);
    const sink = this.options.sink ?? ((l: string) => console.log(l));
    sink(line);
  }
}
