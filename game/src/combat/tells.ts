import type { CombatEvent } from './encounter.js';

type CombatTell = { kind: 'glance' | 'heavy'; text: 'Glances off' | 'Heavy damage' };
type ActiveTell = CombatTell & { id: number };

const tellsFromEvents = (
  events: readonly CombatEvent[],
  options: { enemyId: string; ownedIds: readonly string[] },
): CombatTell[] =>
  events.flatMap<CombatTell>((event) => {
    if (
      event.type !== 'hit' ||
      event.target !== options.enemyId ||
      event.attacker === undefined ||
      !options.ownedIds.includes(event.attacker)
    )
      return [];
    if (event.hideMult === 0.6) return [{ kind: 'glance', text: 'Glances off' }];
    if (event.hideMult === 1.6) return [{ kind: 'heavy', text: 'Heavy damage' }];
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
      return active.map(({ id, kind, text }) => ({ id, kind, text }));
    },
  };
};

export { createTellStack, tellsFromEvents };
export type { ActiveTell, CombatTell };
