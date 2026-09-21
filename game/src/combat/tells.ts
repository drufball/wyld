import type { CombatEvent } from './encounter.js';
import { RESISTANCE_MULTIPLIER, WEAKNESS_MULTIPLIER } from './hides.js';

type CombatTell = {
  kind: 'glance' | 'heavy' | 'ignored';
  text: 'Glances off' | 'Heavy damage' | '…';
  targetId: string;
};
type ActiveTell = CombatTell & { id: number };

const tellsFromEvents = (
  events: readonly CombatEvent[],
  options: { enemyId: string; ownedIds: readonly string[] },
): CombatTell[] =>
  events.flatMap<CombatTell>((event) => {
    if (event.type !== 'hit' || event.attacker === undefined || event.target === undefined)
      return [];
    const partyHitEnemy =
      event.target === options.enemyId && options.ownedIds.includes(event.attacker);
    const enemyHitParty =
      event.attacker === options.enemyId && options.ownedIds.includes(event.target);
    if (!partyHitEnemy && !enemyHitParty) return [];
    if (event.hideMult === RESISTANCE_MULTIPLIER)
      return [{ kind: 'glance', text: 'Glances off', targetId: event.target }];
    if (event.hideMult === WEAKNESS_MULTIPLIER)
      return [{ kind: 'heavy', text: 'Heavy damage', targetId: event.target }];
    return [];
  });

const createTellStack = () => {
  let serial = 0;
  let active: { tell: ActiveTell; remaining: number }[] = [];
  let snapshot: readonly ActiveTell[] = Object.freeze([]);
  return {
    push(tell: CombatTell): void {
      const activeTell = Object.freeze({ ...tell, id: ++serial });
      active.push({ tell: activeTell, remaining: 1 });
      snapshot = Object.freeze(active.map(({ tell: current }) => current));
    },
    update(dt: number): void {
      let expired = false;
      for (const current of active) {
        current.remaining -= dt;
        if (current.remaining <= 0) expired = true;
      }
      if (!expired) return;

      active = active.filter(({ remaining }) => remaining > 0);
      snapshot = Object.freeze(active.map(({ tell: current }) => current));
    },
    list(): readonly ActiveTell[] {
      return snapshot;
    },
  };
};

export { createTellStack, tellsFromEvents };
export type { ActiveTell, CombatTell };
