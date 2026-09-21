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
  it('hands out the same objects until something changes', () => {
    const stack = createTellStack();
    stack.push({ kind: 'glance', text: 'Glances off', targetId: 'first' });
    stack.push({ kind: 'heavy', text: 'Heavy damage', targetId: 'second' });
    stack.push({ kind: 'ignored', text: '…', targetId: 'third' });
    const initial = stack.list();

    stack.update(0.1);
    stack.update(0.2);
    const unchanged = stack.list();
    expect(unchanged).toBe(initial);
    unchanged.forEach((tell, index) => expect(tell).toBe(initial[index]));

    stack.push({ kind: 'glance', text: 'Glances off', targetId: 'fourth' });
    const afterPush = stack.list();
    expect(afterPush).not.toBe(initial);
    afterPush.slice(0, 3).forEach((tell, index) => expect(tell).toBe(initial[index]));

    stack.update(0.7);
    const afterExpiry = stack.list();
    expect(afterExpiry).not.toBe(afterPush);
    expect(afterExpiry).toEqual([afterPush[3]]);
    expect(afterExpiry[0]).toBe(afterPush[3]);
  });
  it('keeps counting a tell down while it hands out the same object', () => {
    const stack = createTellStack();
    stack.push({ kind: 'glance', text: 'Glances off', targetId: 'enemy' });
    const tell = stack.list()[0];

    stack.update(0.5);
    expect(stack.list()[0]).toBe(tell);
    stack.update(0.5);
    expect(stack.list()).toEqual([]);
  });
  it('refuses to be mutated by a renderer', () => {
    const stack = createTellStack();
    stack.push({ kind: 'glance', text: 'Glances off', targetId: 'enemy' });
    const tell = stack.list()[0]!;

    expect(Reflect.set(tell, 'text', 'Heavy damage')).toBe(false);
    expect(stack.list()[0]?.text).toBe('Glances off');
  });
  it('drops only the tell that expired', () => {
    const stack = createTellStack();
    stack.push({ kind: 'glance', text: 'Glances off', targetId: 'first' });
    stack.update(0.5);
    stack.push({ kind: 'heavy', text: 'Heavy damage', targetId: 'second' });
    const survivor = stack.list()[1];

    stack.update(0.5);
    expect(stack.list()).toEqual([survivor]);
    expect(stack.list()[0]).toBe(survivor);
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
