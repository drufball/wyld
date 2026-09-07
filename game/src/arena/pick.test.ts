import { describe, expect, it } from 'vitest';
import {
  backToEnemies,
  canFight,
  chooseEnemy,
  createPick,
  startFight,
  toggleMember,
} from './pick.js';
describe('arena pick', () => {
  it('starts on pick-enemy', () =>
    expect(createPick()).toEqual({ phase: 'pick-enemy', enemy: null, party: [] }));
  it('choosing an enemy moves on and clears party', () =>
    expect(chooseEnemy({ phase: 'fight', enemy: null, party: ['mirefin'] }, 'antlerback')).toEqual({
      phase: 'pick-party',
      enemy: 'antlerback',
      party: [],
    }));
  it('toggles additions and removals', () =>
    expect(toggleMember(toggleMember(createPick(), 'mirefin'), 'mirefin').party).toEqual([]));
  it('refuses a fourth', () =>
    expect(
      toggleMember(
        { phase: 'pick-party', enemy: 'antlerback', party: ['mirefin', 'thornwren', 'ashcrawl'] },
        'emberjack',
      ).party,
    ).toHaveLength(3));
  it('only fights with three', () => {
    expect(canFight({ phase: 'pick-party', enemy: 'antlerback', party: ['mirefin'] })).toBe(false);
    expect(
      startFight({
        phase: 'pick-party',
        enemy: 'antlerback',
        party: ['mirefin', 'thornwren', 'ashcrawl'],
      }).phase,
    ).toBe('fight');
  });
  it('goes back to enemies', () =>
    expect(backToEnemies({ phase: 'fight', enemy: 'x', party: [] })).toEqual(createPick()));
  it('never mutates input', () => {
    const state = { phase: 'pick-party' as const, enemy: 'antlerback', party: ['mirefin'] };
    toggleMember(state, 'ashcrawl');
    expect(state.party).toEqual(['mirefin']);
  });
});
