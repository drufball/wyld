export type LogContext = Record<string, unknown>;
export type LogLevel = 'debug' | 'info' | 'error';

export function log(
  level: LogLevel,
  msg: string,
  context: LogContext = {},
  stream: NodeJS.WritableStream = process.stdout,
): void {
  stream.write(`${JSON.stringify({ ts: new Date().toISOString(), level, msg, ...context })}\n`);
}
