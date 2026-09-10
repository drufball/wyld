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
const enemyHit = (hideMult: number): CombatEvent => ({
  type: 'hit',
  attacker: 'enemy',
  target: 'mine',
  hideMult,
});

describe('combat tells', () => {
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
