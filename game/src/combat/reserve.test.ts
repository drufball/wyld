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
    { id: 'r', downed: false, benched: true },
    { id: 'q', downed: false, benched: true },
  ];
  it('swaps out the one creature that is out', () =>
    expect(swapTapOutcome({ phase: 'fight', party, swapCooldownRemaining: 0 })).toEqual({
      outId: 'a',
    }));
  it('finds the creature that is out wherever it sits in the party', () =>
    expect(
      swapTapOutcome({
        phase: 'fight',
        party: [
          { id: 'r', downed: false, benched: true },
          { id: 'a', downed: false, benched: false },
          { id: 'q', downed: false, benched: true },
        ],
        swapCooldownRemaining: 0,
      }),
    ).toEqual({ outId: 'a' }));
  it('says nobody is in reserve when both reserves are down', () =>
    expect(
      swapTapOutcome({
        phase: 'fight',
        party: party.map((c) => (c.benched ? { ...c, downed: true } : c)),
        swapCooldownRemaining: 0,
      }),
    ).toEqual({ reason: 'Nobody in reserve' }));
  it('says the fight is over outside a fight', () =>
    expect(swapTapOutcome({ phase: 'win', party, swapCooldownRemaining: 0 })).toEqual({
      reason: 'The fight is over',
    }));
  it('says when the swap will be ready during the cooldown', () =>
    expect(swapTapOutcome({ phase: 'fight', party, swapCooldownRemaining: 2.1 })).toEqual({
      reason: 'Swap ready in 3 s',
    }));
  it('lets a downed creature out during the cooldown', () =>
    expect(
      swapTapOutcome({
        phase: 'fight',
        party: party.map((c) => (c.id === 'a' ? { ...c, downed: true } : c)),
        swapCooldownRemaining: 5,
      }),
    ).toEqual({ outId: 'a' }));
});
