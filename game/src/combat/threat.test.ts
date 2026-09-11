import { describe, expect, it } from 'vitest';
import { pickTarget, pruneHits, threatOf, type ThreatHit } from './threat.js';

const hit = (
  attacker: string,
  final: number,
  force: ThreatHit['force'] = 'Cut',
  at = 0,
): ThreatHit => ({ attacker, final, force, at });

describe('threat', () => {
  it("decays a hit's threat linearly to nothing over six seconds", () => {
    const hits = [hit('a', 10)];
    expect(threatOf(hits, 'a', 0)).toBe(10);
    expect(threatOf(hits, 'a', 3)).toBe(5);
    expect(threatOf(hits, 'a', 6)).toBe(0);
    expect(threatOf(hits, 'a', 7)).toBe(0);
    expect(threatOf(hits, 'a', -1)).toBe(0);
  });
  it('spikes threat by twenty for an Impact hit', () => {
    expect(threatOf([hit('a', 4, 'Impact')], 'a', 0)).toBe(24);
    expect(threatOf([hit('a', 4)], 'a', 0)).toBe(4);
  });
  it('sums every hit inside the window per attacker', () => {
    expect(threatOf([hit('a', 4), hit('a', 6, 'Cut', 1), hit('b', 100)], 'a', 1)).toBe(
      9.333333333333334,
    );
  });
  it('prunes hits older than the window and keeps the rest in order', () => {
    const hits = [hit('old', 1, 'Cut', 0), hit('edge', 1, 'Cut', 1), hit('new', 1, 'Cut', 6)];
    expect(pruneHits(hits, 7).map(({ attacker }) => attacker)).toEqual(['new']);
  });
  it('targets the highest threat it can reach', () => {
    const candidates = [
      { id: 'a', distance: 2 },
      { id: 'b', distance: 3 },
      { id: 'c', distance: 1 },
    ];
    expect(pickTarget(candidates, [hit('a', 30), hit('b', 10)], 0, (id) => id !== 'a')).toBe('b');
  });
  it('breaks a threat tie by distance', () => {
    expect(
      pickTarget(
        [
          { id: 'far', distance: 4 },
          { id: 'near', distance: 1 },
        ],
        [hit('far', 10), hit('near', 10)],
        0,
        () => true,
      ),
    ).toBe('near');
  });
  it('falls back to the nearest when nobody has threat', () => {
    const candidates = [
      { id: 'a', distance: 3 },
      { id: 'b', distance: 1 },
      { id: 'c', distance: 2 },
    ];
    expect(pickTarget(candidates, [], 0, () => true)).toBe('b');
    expect(pickTarget(candidates, [], 0, () => false)).toBe('b');
  });
  it('never asks whether a creature with no threat is reachable', () => {
    let calls = 0;
    pickTarget([{ id: 'a', distance: 1 }], [], 0, () => (calls++, true));
    expect(calls).toBe(0);
  });
});
