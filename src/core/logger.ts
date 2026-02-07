/**
 * Structured logger for Exostream
 *
 * Outputs NDJSON (newline-delimited JSON) to console.log.
 * Works in both Node.js and Cloudflare Workers runtime.
 * Zero external dependencies.
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogContext {
  component?: string;
  request_id?: string;
  duration_ms?: number;
  error?: string | Error;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

export class Logger {
  private defaultContext: LogContext;
  private minLevel: LogLevel;

  constructor(defaultContext: LogContext = {}, minLevel: LogLevel = 'info') {
    this.defaultContext = defaultContext;
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.minLevel];
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.defaultContext,
      ...context,
    };

    console.log(JSON.stringify(entry));
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  child(context: LogContext): Logger {
    return new Logger(
      { ...this.defaultContext, ...context },
      this.minLevel
    );
  }
}

export const logger = new Logger();
