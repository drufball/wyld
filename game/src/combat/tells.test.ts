import { describe, expect, it } from 'vitest';
import type { CombatEvent } from './encounter.js';
import { hideMultiplier, resistance, weakness } from './hides.js';
import type { Force } from './moves.js';
import { createTellStack, tellsFromEvents } from './tells.js';

const hit = (hideMult: number): CombatEvent => ({
  type: 'hit',
  attacker: 'mine',
  target: 'enemy',
  hideMult,
});
const read = (hideMult: number) =>
  tellsFromEvents([hit(hideMult)], { enemyId: 'enemy', ownedIds: ['mine'] });
const enemyHit = (hideMult: number): CombatEvent => ({
  type: 'hit',
  attacker: 'enemy',
  target: 'mine',
  hideMult,
});

describe('combat tells', () => {
  it("shows a tell for every hide's weakness and resistance", () => {
    const hides = ['Bark', 'Shell', 'Scale', 'Hide', 'Stone'] as const;
    const forces: Force[] = ['Impact', 'Cut', 'Heat', 'Surge'];
    for (const hide of hides) {
      expect(read(hideMultiplier(hide, weakness(hide)))[0]?.kind).toBe('heavy');
      expect(read(hideMultiplier(hide, resistance(hide)))[0]?.kind).toBe('glance');
      const neutral = forces.find(
        (force) => force !== weakness(hide) && force !== resistance(hide),
      );
      expect(neutral).toBeDefined();
      expect(read(hideMultiplier(hide, neutral!))).toEqual([]);
    }
  });

  it('raises a glance tell when a resisted move hits', () =>
    expect(read(0.6)).toEqual([{ kind: 'glance', text: 'Glances off', targetId: 'enemy' }]));
  it('raises a heavy-damage tell when a weak force lands', () =>
    expect(read(1.6)).toEqual([{ kind: 'heavy', text: 'Heavy damage', targetId: 'enemy' }]));
  it('raises no tell for a neutral hit', () => expect(read(1)).toEqual([]));
  it('drops a tell after a second', () => {
    const stack = createTellStack();
    stack.push({ kind: 'glance', text: 'Glances off', targetId: 'enemy' });
    stack.update(1);
    expect(stack.list()).toEqual([]);
  });
  it('raises a glance tell over a party creature an enemy move glanced off', () => {
    expect(tellsFromEvents([enemyHit(0.6)], { enemyId: 'enemy', ownedIds: ['mine'] })).toEqual([
      { kind: 'glance', text: 'Glances off', targetId: 'mine' },
    ]);
  });
  it('raises a heavy-damage tell over a party creature an enemy move landed hard on', () => {
    expect(tellsFromEvents([enemyHit(1.6)], { enemyId: 'enemy', ownedIds: ['mine'] })).toEqual([
      { kind: 'heavy', text: 'Heavy damage', targetId: 'mine' },
    ]);
  });
  it('raises no tell for a neutral hit on a party creature', () => {
    expect(tellsFromEvents([enemyHit(1)], { enemyId: 'enemy', ownedIds: ['mine'] })).toEqual([]);
  });
  it('names the creature each tell belongs over', () => {
    expect(read(0.6)[0]?.targetId).toBe('enemy');
    expect(
      tellsFromEvents([enemyHit(0.6)], { enemyId: 'enemy', ownedIds: ['mine'] })[0]?.targetId,
    ).toBe('mine');
  });
  it('still raises tells over the enemy for your own hits', () => {
    expect(read(1.6)).toEqual([{ kind: 'heavy', text: 'Heavy damage', targetId: 'enemy' }]);
  });
});
