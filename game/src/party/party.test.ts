import { describe, expect, it } from 'vitest';
import type { Individual } from '../creatures/individual.js';
import {
  addPartyMember,
  createParty,
  followerPath,
  formationTiles,
  groundTapped,
  isRinged,
  removePartyMember,
  selectCreature,
  selectPlayer,
  targetWildCreature,
} from './party.js';

const individual = (id: string): Individual => ({
  id,
  speciesId: 'loamox',
  temperament: 'Steady',
  stats: { vigor: 70, power: 3, speed: 4, focus: 40 },
  repertoire: [],
});
const members = ['barrow', 'b', 'c'].map((id) => ({
  individual: individual(id),
  name: id,
  tile: { tx: 0, ty: 0 },
  path: [],
}));
describe('party', () => {
  it('starts with Barrow selected as the player rather than the creature', () =>
    expect(createParty(members).selection).toBe('player'));
  it('selects a creature when it is tapped and rings it', () => {
    const state = selectCreature(createParty(members), 'barrow');
    expect(isRinged(state, 'barrow')).toBe(true);
  });
  it('returns selection to the player when the player is tapped', () =>
    expect(selectPlayer(selectCreature(createParty(members), 'barrow')).selection).toBe('player'));
  it('sets a target when a wild creature is tapped without changing selection', () => {
    const state = targetWildCreature(selectCreature(createParty(members), 'barrow'), {
      id: 'wild',
      speciesId: 'mirefin',
    });
    expect(state).toMatchObject({ selection: 'barrow', target: { id: 'wild' } });
  });
  it('clears the target on the next ground tap', () =>
    expect(
      groundTapped(targetWildCreature(createParty(members), { id: 'wild', speciesId: 'mirefin' }))
        .target,
    ).toBeNull());
  it('places three followers at distinct formation offsets behind the player', () =>
    expect(new Set(formationTiles({ tx: 8, ty: 8 }).map((p) => `${p.tx},${p.ty}`)).size).toBe(3));
  it('repaths a follower only when it is more than two tiles from its offset', () => {
    const grid = { isWalkable: () => true };
    expect(followerPath(grid, { tx: 0, ty: 0 }, { tx: 2, ty: 0 })).toBeNull();
    expect(followerPath(grid, { tx: 0, ty: 0 }, { tx: 3, ty: 0 })).not.toBeNull();
  });
  it('adds members up to three and removes them by individual id', () => {
    const first = createParty([members[0]!]);
    const full = addPartyMember(addPartyMember(first, members[1]!), members[2]!);
    expect(addPartyMember(full, { ...members[2]!, individual: individual('d') })).toBe(full);
    expect(removePartyMember(selectCreature(full, 'b'), 'b')).toMatchObject({
      selection: 'player',
      party: [{ individual: { id: 'barrow' } }, { individual: { id: 'c' } }],
    });
  });
});
