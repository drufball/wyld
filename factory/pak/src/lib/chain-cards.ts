import type { Chain } from '@wyld/shared';

export type DemoCard = {
  demoId: string;
  title: string;
  demoKind: 'disc' | 'live' | 'pak';
  summary: string | null;
  steps: string[];
  seeded: string[];
  deepLink: string | null;
  url: string;
  status: 'building' | 'ready' | 'failed';
  builtAt: string | null;
  error: string | null;
};

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function demoCard(chain: Chain): DemoCard | null {
  if (chain.kind !== 'demo' || chain.demoId === null || chain.payload === null) return null;
  const payload = chain.payload;
  if (typeof payload['title'] !== 'string') return null;
  const deepLink = typeof payload['deepLink'] === 'string' ? payload['deepLink'] : null;
  const demoKind =
    payload['kind'] === 'disc' || payload['kind'] === 'pak' || payload['kind'] === 'live'
      ? payload['kind']
      : 'live';
  const status =
    payload['status'] === 'building' ||
    payload['status'] === 'failed' ||
    payload['status'] === 'ready'
      ? payload['status']
      : 'ready';
  return {
    demoId: chain.demoId,
    title: payload['title'],
    demoKind,
    summary: typeof payload['summary'] === 'string' ? payload['summary'] : null,
    steps: strings(payload['steps']),
    seeded: strings(payload['seeded']),
    deepLink,
    url: typeof payload['url'] === 'string' ? payload['url'] : (deepLink ?? '/'),
    status,
    builtAt: typeof payload['builtAt'] === 'string' ? payload['builtAt'] : null,
    error: typeof payload['error'] === 'string' ? payload['error'] : null,
  };
}

export type UnlockCard = { achievementId: string; name: string; badge: string };

export function unlockCard(chain: Chain): UnlockCard | null {
  if (chain.kind !== 'unlock' || chain.payload === null) return null;
  const { achievementId, name, badge } = chain.payload;
  return typeof achievementId === 'string' && typeof name === 'string' && typeof badge === 'string'
    ? { achievementId, name, badge }
    : null;
}
