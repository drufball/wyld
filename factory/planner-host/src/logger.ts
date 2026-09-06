export type LogContext = Record<string, unknown>;
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type Logger = (level: LogLevel, msg: string, context?: LogContext) => void;

export const log: Logger = (level, msg, context = {}) => {
  process.stdout.write(
    `${JSON.stringify({ ts: new Date().toISOString(), level, msg, ...context })}\n`,
  );
};
