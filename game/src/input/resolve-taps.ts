import { TILE_METRES, worldToTile } from '../world/tiles.js';

type TapPoint = { clientX: number; clientY: number };

type TapBody = {
  key: string;
  tileX: number;
  tileY: number;
  tier: 1 | 2 | 3 | null;
};

type TapWild = {
  id: string;
  speciesId: string;
  position: { x: number; z: number };
};

type TapCombatant = { benched?: boolean; downed?: boolean };

type TapIntent =
  | { kind: 'select-creature'; id: string }
  | { kind: 'select-player' }
  | { kind: 'target-wild'; id: string; speciesId: string }
  | { kind: 'clear-target' }
  | { kind: 'walk-player'; clientX: number; clientY: number }
  | { kind: 'order-walk'; creatureId: string; clientX: number; clientY: number };

type ResolveTapsInput = {
  taps: readonly TapPoint[];
  selection: 'player' | string;
  party: readonly { id: string; speciesId: string }[];
  partyTile: (id: string) => { x: number; y: number };
  combatantOf: (id: string) => TapCombatant | null | undefined;
  playerTile: { x: number; y: number };
  listWild: () => readonly TapWild[];
  tierOf: (speciesId: string) => 1 | 2 | 3;
  tileOnScreen: (tx: number, ty: number) => boolean;
  makeBodyPicker: (
    bodies: readonly TapBody[],
  ) => (clientX: number, clientY: number) => string | null;
  pickTile: (clientX: number, clientY: number) => { tx: number; ty: number };
};

const resolveTaps = (input: ResolveTapsInput): readonly TapIntent[] => {
  if (input.taps.length === 0) return [];

  const wild = input.listWild();
  const partyBodies = input.party.flatMap(({ id, speciesId }) => {
    const combatant = input.combatantOf(id);
    if (combatant?.benched || combatant?.downed) return [];
    const tile = input.partyTile(id);
    if (!input.tileOnScreen(tile.x, tile.y)) return [];
    return [{ key: id, tileX: tile.x, tileY: tile.y, tier: input.tierOf(speciesId) }];
  });
  const wildBodies = wild.flatMap(({ id, speciesId, position }) => {
    const tile = worldToTile(position.x, position.z);
    if (!input.tileOnScreen(tile.tx, tile.ty)) return [];
    return [
      {
        key: id,
        tileX: (position.x + 400) / TILE_METRES,
        tileY: (position.z + 400) / TILE_METRES,
        tier: input.tierOf(speciesId),
      },
    ];
  });
  const bodyAt = input.makeBodyPicker([
    ...partyBodies,
    { key: 'player', tileX: input.playerTile.x, tileY: input.playerTile.y, tier: null },
    ...wildBodies,
  ]);
  const intents: TapIntent[] = [];
  let selection = input.selection;

  for (const tap of input.taps) {
    const bodyHit = bodyAt(tap.clientX, tap.clientY);
    if (bodyHit) {
      const partyHit = input.party.find(({ id }) => id === bodyHit);
      const wildHit = wild.find(({ id }) => id === bodyHit);
      if (partyHit) {
        intents.push({ kind: 'select-creature', id: bodyHit });
        selection = bodyHit;
      } else if (bodyHit === 'player') {
        intents.push({ kind: 'select-player' });
        selection = 'player';
      } else if (wildHit) {
        intents.push({ kind: 'target-wild', id: wildHit.id, speciesId: wildHit.speciesId });
      }
      continue;
    }

    const { tx, ty } = input.pickTile(tap.clientX, tap.clientY);
    const partyHit = input.party.find(({ id }) => {
      if (input.combatantOf(id)?.benched) return false;
      const tile = input.partyTile(id);
      return Math.floor(tile.x) === tx && Math.floor(tile.y) === ty;
    });
    const wildHit = wild.find(({ position }) => {
      const tile = worldToTile(position.x, position.z);
      return tile.tx === tx && tile.ty === ty;
    });
    if (partyHit) {
      intents.push({ kind: 'select-creature', id: partyHit.id });
      selection = partyHit.id;
    } else if (Math.floor(input.playerTile.x) === tx && Math.floor(input.playerTile.y) === ty) {
      intents.push({ kind: 'select-player' });
      selection = 'player';
    } else if (wildHit) {
      intents.push({ kind: 'target-wild', id: wildHit.id, speciesId: wildHit.speciesId });
    } else {
      intents.push({ kind: 'clear-target' });
      if (selection === 'player')
        intents.push({ kind: 'walk-player', clientX: tap.clientX, clientY: tap.clientY });
      else
        intents.push({
          kind: 'order-walk',
          creatureId: selection,
          clientX: tap.clientX,
          clientY: tap.clientY,
        });
    }
  }

  return intents;
};

export { resolveTaps };
export type { ResolveTapsInput, TapBody, TapCombatant, TapIntent, TapPoint, TapWild };
