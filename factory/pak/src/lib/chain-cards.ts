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

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export type UnlockCard = { achievementId: string; name: string; badge: string };

export function lookCard(chain: Chain): { explainer: string } | null {
  if (chain.kind !== 'message' || chain.payload === null) return null;
  const explainer = chain.payload['explainer'];
  return typeof explainer === 'string' ? { explainer } : null;
}

export function unlockCard(chain: Chain): UnlockCard | null {
  if (chain.kind !== 'unlock' || chain.payload === null) return null;
  const { achievementId, name, badge } = chain.payload;
  return typeof achievementId === 'string' && typeof name === 'string' && typeof badge === 'string'
    ? { achievementId, name, badge }
    : null;
}
