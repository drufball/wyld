export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogContext = Record<string, unknown>;
export type Logger = (level: LogLevel, msg: string, context?: LogContext) => void;
export type LogStream = { write(chunk: string): unknown };

declare const process: { stdout: LogStream };

export function log(
  level: LogLevel,
  msg: string,
  context: LogContext = {},
  stream: LogStream = process.stdout,
): void {
  stream.write(`${JSON.stringify({ ts: new Date().toISOString(), level, msg, ...context })}\n`);
}

export function createLogger(stream: LogStream): Logger {
  return (level, msg, context) => log(level, msg, context, stream);
}
