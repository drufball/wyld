export const SCRUBBED_KEYS = ['WAKE_URL', 'WAKE_SECRET', 'NTFY_URL', 'NTFY_BASE_URL'] as const;

/**
 * Removes the Wake/ntfy credentials from an environment object and returns the values that
 * were present, so the caller can hand them to the one child that needs them.
 */
export function scrubSecrets(environment: NodeJS.ProcessEnv): Record<string, string> {
  const removed: Record<string, string> = {};

  for (const key of SCRUBBED_KEYS) {
    const value = environment[key];
    if (typeof value === 'string') removed[key] = value;
    delete environment[key];
  }

  return removed;
}
