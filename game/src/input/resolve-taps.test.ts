import { describe, expect, it, vi } from 'vitest';
import { resolveTaps, type ResolveTapsInput, type TapBody } from './resolve-taps.js';

const tap = { clientX: 11, clientY: 22 };
const makeInput = (overrides: Partial<ResolveTapsInput> = {}): ResolveTapsInput => ({
  taps: [tap],
  selection: 'a',
  party: [{ id: 'a', speciesId: 'species-a' }],
  partyTile: () => ({ x: 1.25, y: 2.75 }),
  combatantOf: () => null,
  playerTile: { x: 8.5, y: 9.5 },
  listWild: () => [],
  tierOf: () => 1,
  tileOnScreen: () => true,
  makeBodyPicker: () => () => null,
  pickTile: () => ({ tx: 99, ty: 99 }),
  ...overrides,
});

describe('resolveTaps', () => {
  it('a tap on a body never falls through to the ground path', () => {
    const pickTile = vi.fn(() => ({ tx: 3, ty: 4 }));
    const intents = resolveTaps(
      makeInput({
        party: [
          { id: 'a', speciesId: 'species-a' },
          { id: 'b', speciesId: 'species-b' },
        ],
        makeBodyPicker: () => () => 'a',
        pickTile,
      }),
    );

    expect(intents).toEqual([{ kind: 'select-creature', id: 'a' }]);
    expect(pickTile).not.toHaveBeenCalled();
  });

  it('a tap on empty ground walks the selected creature', () => {
    expect(resolveTaps(makeInput())).toEqual([
      { kind: 'clear-target' },
      { kind: 'order-walk', creatureId: 'a', clientX: 11, clientY: 22 },
    ]);
  });

  it('a tap on empty ground walks the player when the player is selected', () => {
    expect(resolveTaps(makeInput({ selection: 'player' }))).toEqual([
      { kind: 'clear-target' },
      { kind: 'walk-player', clientX: 11, clientY: 22 },
    ]);
  });

  it('lists the registry at most once, whatever the tap count', () => {
    for (const bodyHit of ['a', null]) {
      for (const count of [0, 1, 5]) {
        const listWild = vi.fn(() => []);
        const makeBodyPicker = vi.fn(() => () => bodyHit);
        resolveTaps(
          makeInput({
            taps: Array.from({ length: count }, (_, index) => ({
              clientX: index,
              clientY: index,
            })),
            listWild,
            makeBodyPicker,
          }),
        );
        expect(listWild).toHaveBeenCalledTimes(count === 0 ? 0 : 1);
        expect(makeBodyPicker).toHaveBeenCalledTimes(count === 0 ? 0 : 1);
      }
    }
  });

  it('a benched creature cannot be selected', () => {
    let bodies: readonly TapBody[] = [];
    const intents = resolveTaps(
      makeInput({
        combatantOf: () => ({ benched: true }),
        makeBodyPicker: (value) => {
          bodies = value;
          return () => null;
        },
        pickTile: () => ({ tx: 1, ty: 2 }),
      }),
    );

    expect(bodies.map(({ key }) => key)).toEqual(['player']);
    expect(intents).toEqual([
      { kind: 'clear-target' },
      { kind: 'order-walk', creatureId: 'a', clientX: 11, clientY: 22 },
    ]);
  });

  it('a downed creature is still selectable by its tile', () => {
    let bodies: readonly TapBody[] = [];
    const intents = resolveTaps(
      makeInput({
        combatantOf: () => ({ downed: true }),
        makeBodyPicker: (value) => {
          bodies = value;
          return () => null;
        },
        pickTile: () => ({ tx: 1, ty: 2 }),
      }),
    );

    expect(bodies.map(({ key }) => key)).toEqual(['player']);
    expect(intents).toEqual([{ kind: 'select-creature', id: 'a' }]);
  });

  it('selection threads through the taps in one frame', () => {
    const intents = resolveTaps(
      makeInput({
        taps: [tap, { clientX: 33, clientY: 44 }],
        party: [
          { id: 'a', speciesId: 'species-a' },
          { id: 'b', speciesId: 'species-b' },
        ],
        makeBodyPicker: () => (clientX) => (clientX === 11 ? 'b' : null),
      }),
    );

    expect(intents).toEqual([
      { kind: 'select-creature', id: 'b' },
      { kind: 'clear-target' },
      { kind: 'order-walk', creatureId: 'b', clientX: 33, clientY: 44 },
    ]);
  });

  it('builds the candidate list as party, then player, then wild', () => {
    let bodies: readonly TapBody[] = [];
    resolveTaps(
      makeInput({
        party: [
          { id: 'a', speciesId: 'one' },
          { id: 'b', speciesId: 'two' },
        ],
        partyTile: (id) => (id === 'a' ? { x: 1.25, y: 2.75 } : { x: 3.5, y: 4.5 }),
        playerTile: { x: 5.5, y: 6.5 },
        listWild: () => [
          { id: 'w1', speciesId: 'three', position: { x: -397, z: -395 } },
          { id: 'w2', speciesId: 'two', position: { x: -393, z: -391 } },
        ],
        tierOf: (speciesId) => ({ one: 1, two: 2, three: 3 })[speciesId] as 1 | 2 | 3,
        makeBodyPicker: (value) => {
          bodies = value;
          return () => null;
        },
      }),
    );

    expect(bodies).toEqual([
      { key: 'a', tileX: 1.25, tileY: 2.75, tier: 1 },
      { key: 'b', tileX: 3.5, tileY: 4.5, tier: 2 },
      { key: 'player', tileX: 5.5, tileY: 6.5, tier: null },
      { key: 'w1', tileX: 1.5, tileY: 2.5, tier: 3 },
      { key: 'w2', tileX: 3.5, tileY: 4.5, tier: 2 },
    ]);
  });

  it('keeps off-screen creatures out of the candidates but still resolves them as hits', () => {
    const wild = [{ id: 'hidden', speciesId: 'species-w', position: { x: -379, z: -377 } }];
    const seen: TapBody[][] = [];
    const base = {
      listWild: () => wild,
      tileOnScreen: (tx: number) => tx < 10,
      makeBodyPicker: (bodies: readonly TapBody[]) => {
        seen.push([...bodies]);
        return () => 'hidden';
      },
    };
    expect(resolveTaps(makeInput(base))).toEqual([
      { kind: 'target-wild', id: 'hidden', speciesId: 'species-w' },
    ]);
    expect(seen[0]!.map(({ key }) => key)).not.toContain('hidden');

    expect(
      resolveTaps(
        makeInput({
          ...base,
          makeBodyPicker: (bodies) => {
            seen.push([...bodies]);
            return () => null;
          },
          pickTile: () => ({ tx: 10, ty: 11 }),
        }),
      ),
    ).toEqual([{ kind: 'target-wild', id: 'hidden', speciesId: 'species-w' }]);
    expect(seen[1]!.map(({ key }) => key)).not.toContain('hidden');
  });

  it("tapping the player's tile selects the player", () => {
    expect(resolveTaps(makeInput({ pickTile: () => ({ tx: 8, ty: 9 }) }))).toEqual([
      { kind: 'select-player' },
    ]);
  });

  it("tapping a wild creature's tile targets it", () => {
    expect(
      resolveTaps(
        makeInput({
          listWild: () => [{ id: 'wild', speciesId: 'species-w', position: { x: -379, z: -377 } }],
          pickTile: () => ({ tx: 10, ty: 11 }),
        }),
      ),
    ).toEqual([{ kind: 'target-wild', id: 'wild', speciesId: 'species-w' }]);
  });
});
