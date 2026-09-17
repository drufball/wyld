import { describe, expect, it } from 'vitest';
import { entryTile, swapTapOutcome } from './reserve.js';

describe('reserve', () => {
  const open = () => true;
  it('steps one tile directly away from the enemy', () =>
    expect(
      entryTile({
        fallen: { x: 2.5, y: 2.5 },
        enemy: { x: 2.5, y: 1.5 },
        isWalkable: open,
        occupied: [],
      }),
    ).toEqual({ x: 2.5, y: 3.5 }));
  it('walks round a rock in the way', () =>
    expect(
      entryTile({
        fallen: { x: 2.5, y: 2.5 },
        enemy: { x: 2.5, y: 1.5 },
        isWalkable: (x, y) => x !== 2 || y !== 3,
        occupied: [],
      }),
    ).not.toEqual({ x: 2.5, y: 3.5 }));
  it('keeps a tile clear of every standing combatant', () => {
    const occupied = [
      { x: 2.5, y: 3.5 },
      { x: 2.5, y: 4.5 },
    ];
    const result = entryTile({
      fallen: { x: 2.5, y: 2.5 },
      enemy: { x: 2.5, y: 1.5 },
      isWalkable: open,
      occupied,
    });
    expect(occupied.every((p) => Math.hypot(result.x - p.x, result.y - p.y) >= 1)).toBe(true);
  });
  it('falls back to the fallen tile when nothing around it is free', () =>
    expect(
      entryTile({
        fallen: { x: 2.2, y: 2.2 },
        enemy: { x: 2.5, y: 1.5 },
        isWalkable: () => false,
        occupied: [],
      }),
    ).toEqual({ x: 2.5, y: 2.5 }));
  const party = [
    { id: 'a', downed: false, benched: false },
    { id: 'b', downed: false, benched: false },
    { id: 'r', downed: false, benched: true },
  ];
  it('swaps out the selected creature', () =>
    expect(
      swapTapOutcome({ phase: 'fight', selection: 'b', party, swapCooldownRemaining: 0 }),
    ).toEqual({ outId: 'b' }));
  it('swaps out the only creature that is out when the player is selected', () =>
    expect(
      swapTapOutcome({
        phase: 'fight',
        selection: 'player',
        party: party.map((c) => (c.id === 'b' ? { ...c, benched: true } : c)),
        swapCooldownRemaining: 0,
      }),
    ).toEqual({ outId: 'a' }));
  it('swaps out the downed creature when the player is selected', () =>
    expect(
      swapTapOutcome({
        phase: 'fight',
        selection: 'player',
        party: party.map((c) => (c.id === 'a' ? { ...c, downed: true } : c)),
        swapCooldownRemaining: 0,
      }),
    ).toEqual({ outId: 'a' }));
  it('asks who to swap out when nobody is selected or down', () =>
    expect(
      swapTapOutcome({ phase: 'fight', selection: 'player', party, swapCooldownRemaining: 0 }),
    ).toEqual({ reason: 'Pick who to swap out' }));
  it('says when the swap will be ready during the cooldown', () =>
    expect(
      swapTapOutcome({ phase: 'fight', selection: 'a', party, swapCooldownRemaining: 2.1 }),
    ).toEqual({ reason: 'Swap ready in 3 s' }));
  it('lets a downed creature out during the cooldown', () =>
    expect(
      swapTapOutcome({
        phase: 'fight',
        selection: 'a',
        party: party.map((c) => (c.id === 'a' ? { ...c, downed: true } : c)),
        swapCooldownRemaining: 5,
      }),
    ).toEqual({ outId: 'a' }));
});
