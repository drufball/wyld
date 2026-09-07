import type { Move } from '../combat/moves.js';
import type { Rng } from '../engine/rng.js';
import type { SpeciesData, Temperament } from './species.js';

type Individual = {
  id: string;
  speciesId: string;
  temperament: Temperament;
  stats: { vigor: number; power: number; speed: number; focus: number };
  repertoire: Move[];
};

const temperamentOrder: readonly Temperament[] = ['Skittish', 'Bold', 'Steady', 'Erratic'];
let nextId = 1;
const kebab = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const rollStat = ([minimum, maximum]: [number, number], rng: Rng): number =>
  minimum + rng.int(maximum - minimum + 1);

const roll = (species: SpeciesData, rng: Rng, id?: string): Individual => {
  const stats = {
    vigor: rollStat(species.stats.vigor, rng),
    power: rollStat(species.stats.power, rng),
    speed: rollStat(species.stats.speed, rng),
    focus: rollStat(species.stats.focus, rng),
  };
  const selection = rng.next();
  let cumulative = 0;
  let temperament: Temperament =
    temperamentOrder.findLast((entry) => species.temperament[entry] !== undefined) ?? 'Steady';
  for (const entry of temperamentOrder) {
    cumulative += species.temperament[entry] ?? 0;
    if (selection < cumulative) {
      temperament = entry;
      break;
    }
  }
  const repertoire = species.signatureMoves.map((move) => ({
    id: `${species.id}:${kebab(move.name)}`,
    ...move,
    cooldownMult: 1,
    rangeMult: 1,
    modifiers: [],
    familiarity: 0,
    upgradeLevel: 0,
  }));
  return {
    id: id ?? `${species.id}-${nextId++}`,
    speciesId: species.id,
    temperament,
    stats,
    repertoire,
  };
};

export { kebab, roll };
export type { Individual, Temperament };
