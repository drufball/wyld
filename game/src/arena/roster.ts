import data from '../data/arena.json';
import { kebab, type Individual } from '../creatures/individual.js';
import { speciesById, type Temperament } from '../creatures/species.js';
import { weakness } from '../combat/hides.js';

type ArenaCreature = {
  id: string;
  speciesId: string;
  name: string;
  temperament: Temperament;
  stats: { vigor: number; power: number; speed: number; focus: number };
};
type ArenaEnemy = ArenaCreature & { biome: 'forest' | 'desert' | 'archipelago' };
type ArenaData = { roster: ArenaCreature[]; enemies: ArenaEnemy[] };
const arenaData = data as ArenaData;
const arenaRoster = (): readonly ArenaCreature[] => arenaData.roster;
const arenaEnemies = (): readonly ArenaEnemy[] => arenaData.enemies;
const rosterMember = (id: string): ArenaCreature | null =>
  arenaData.roster.find((x) => x.id === id) ?? null;
const enemy = (id: string): ArenaEnemy | null => arenaData.enemies.find((x) => x.id === id) ?? null;
const buildArenaIndividual = (entry: ArenaCreature): Individual => {
  const definition = speciesById(entry.speciesId);
  if (!definition) throw new Error(`Unknown species: ${entry.speciesId}`);
  return {
    id: entry.id,
    speciesId: entry.speciesId,
    temperament: entry.temperament,
    stats: { ...entry.stats },
    repertoire: definition.signatureMoves.map((move) => ({
      id: `${entry.speciesId}:${kebab(move.name)}`,
      ...move,
      cooldownMult: 1,
      rangeMult: 1,
      modifiers: [],
      familiarity: 0,
      upgradeLevel: 0,
    })),
  };
};
const counters = (enemyId: string): string[] => {
  const foe = enemy(enemyId);
  if (!foe) return [];
  const definition = speciesById(foe.speciesId);
  if (!definition) return [];
  const force = weakness(definition.hide);
  return arenaData.roster
    .filter((entry) => buildArenaIndividual(entry).repertoire.some((move) => move.force === force))
    .map((entry) => entry.id);
};
export { arenaEnemies, arenaRoster, buildArenaIndividual, counters, enemy, rosterMember };
export type { ArenaCreature, ArenaData, ArenaEnemy };
