import { describe, expect, it } from 'vitest';
import type { CombatEvent } from './encounter.js';
import { createTellStack, tellsFromEvents } from './tells.js';

const hit = (hideMult: number): CombatEvent => ({
  type: 'hit',
  attacker: 'mine',
  target: 'enemy',
  hideMult,
});
const read = (hideMult: number) =>
  tellsFromEvents([hit(hideMult)], { enemyId: 'enemy', ownedIds: ['mine'] });

describe('combat tells', () => {
  it('raises a glance tell when a resisted move hits', () =>
    expect(read(0.6)).toEqual([{ kind: 'glance', text: 'Glances off' }]));
  it('raises a heavy-damage tell when a weak force lands', () =>
    expect(read(1.6)).toEqual([{ kind: 'heavy', text: 'Heavy damage' }]));
  it('raises no tell for a neutral hit', () => expect(read(1)).toEqual([]));
  it('drops a tell after a second', () => {
    const stack = createTellStack();
    stack.push({ kind: 'glance', text: 'Glances off' });
    stack.update(1);
    expect(stack.list()).toEqual([]);
  });
});
