import type { Chain } from '@wyld/shared';

type BriefingLine = { text: string; deepLink?: string };
export type BriefingCard = {
  rumbles: BriefingLine[];
  demos: BriefingLine[];
  shipped: BriefingLine[];
  fyi: string[];
  updatedAt: string;
  toEventId: number;
};

function lines(value: unknown): BriefingLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null || !('text' in item)) return [];
    const text = item.text;
    if (typeof text !== 'string' || text.length === 0) return [];
    const deepLink = 'deepLink' in item ? item.deepLink : undefined;
    return deepLink === undefined || typeof deepLink === 'string' ? [{ text, deepLink }] : [];
  });
}

export function briefingCard(chain: Chain): BriefingCard | null {
  if (chain.kind !== 'briefing' || chain.payload === null) return null;
  const { updatedAt, toEventId } = chain.payload;
  if (typeof updatedAt !== 'string' || typeof toEventId !== 'number') return null;
  return {
    rumbles: lines(chain.payload['rumbles']),
    demos: lines(chain.payload['demos']),
    shipped: lines(chain.payload['shipped']),
    fyi: strings(chain.payload['fyi']),
    updatedAt,
    toEventId,
  };
}

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
