import type { CombatEvent } from './encounter.js';

type CombatTell = {
  kind: 'glance' | 'heavy' | 'ignored' | 'slowed' | 'held';
  text: 'Glances off' | 'Heavy damage' | '…' | 'Slowed' | 'Held';
  targetId: string;
};
type ActiveTell = CombatTell & { id: number };

const tellsFromEvents = (
  events: readonly CombatEvent[],
  options: { enemyId: string; ownedIds: readonly string[] },
): CombatTell[] => {
  const tells: CombatTell[] = [],
    slowedTargets = new Set<string>();
  for (const event of events) {
    if (event.attacker === undefined || event.target === undefined) continue;
    const partyHitEnemy =
      event.target === options.enemyId && options.ownedIds.includes(event.attacker);
    const enemyHitParty =
      event.attacker === options.enemyId && options.ownedIds.includes(event.target);
    if (!partyHitEnemy && !enemyHitParty) continue;
    if (event.type === 'slowed') {
      if (!slowedTargets.has(event.target)) {
        slowedTargets.add(event.target);
        tells.push({ kind: 'slowed', text: 'Slowed', targetId: event.target });
      }
      continue;
    }
    if (event.type === 'held') {
      tells.push({ kind: 'held', text: 'Held', targetId: event.target });
      continue;
    }
    if (event.type !== 'hit') continue;
    if (event.hideMult === 0.6)
      tells.push({ kind: 'glance', text: 'Glances off', targetId: event.target });
    if (event.hideMult === 1.6)
      tells.push({ kind: 'heavy', text: 'Heavy damage', targetId: event.target });
  }
  return tells;
};

const createTellStack = () => {
  let serial = 0;
  let active: (ActiveTell & { remaining: number })[] = [];
  return {
    push(tell: CombatTell): void {
      active.push({ ...tell, id: ++serial, remaining: 1 });
    },
    update(dt: number): void {
      active = active
        .map((tell) => ({ ...tell, remaining: tell.remaining - dt }))
        .filter(({ remaining }) => remaining > 0);
    },
    list(): ActiveTell[] {
      return active.map(({ id, kind, text, targetId }) => ({ id, kind, text, targetId }));
    },
  };
};

export { createTellStack, tellsFromEvents };
export type { ActiveTell, CombatTell };
