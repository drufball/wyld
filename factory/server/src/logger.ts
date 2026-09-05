export type LogContext = Record<string, unknown>;

export function log(level: 'info' | 'error', msg: string, context: LogContext = {}): void {
  process.stdout.write(
    `${JSON.stringify({ ts: new Date().toISOString(), level, msg, ...context })}\n`,
  );
}
