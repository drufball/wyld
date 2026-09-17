export type ModelLimit = { until?: string };

export const RATE_LIMIT_PATTERN = /\b429\b|rate[_\s-]?limit/i;
export const MODEL_LIMIT_PATTERN =
  /reached your .{0,40}\blimit\b|usage limit|model limit|switch to another model|weekly limit|seven[_\s-]?day/i;

export function modelLimitFromMessage(message: unknown): ModelLimit | null {
  if (typeof message !== 'object' || message === null) return null;
  const value = message as Record<string, unknown>;
  const info = value.rate_limit_info;
  if (
    value.type !== 'rate_limit_event' ||
    typeof info !== 'object' ||
    info === null ||
    (info as Record<string, unknown>).status !== 'rejected'
  )
    return null;
  const resetsAt = (info as Record<string, unknown>).resetsAt;
  if (typeof resetsAt !== 'number' || !Number.isFinite(resetsAt)) return {};
  // The SDK only promises `number`; tolerate both epoch seconds and epoch milliseconds.
  const milliseconds = resetsAt < 1e12 ? resetsAt * 1_000 : resetsAt;
  const date = new Date(milliseconds);
  return Number.isFinite(date.getTime()) ? { until: date.toISOString() } : {};
}

export function modelLimitFromError(error: unknown): ModelLimit | null {
  let text = String(error);
  if (typeof error === 'object' && error !== null) {
    const value = error as { message?: unknown; stack?: unknown };
    if (value.message !== undefined) text += ` ${String(value.message)}`;
    if (value.stack !== undefined) text += ` ${String(value.stack)}`;
  }
  return RATE_LIMIT_PATTERN.test(text) && MODEL_LIMIT_PATTERN.test(text) ? {} : null;
}
