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
