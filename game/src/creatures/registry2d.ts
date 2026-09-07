import type { Individual } from './individual.js';
import type { Temperament } from './species.js';

type CreatureState = 'idle' | 'walk' | 'execute';
type SpawnedCreature = {
  id: string;
  speciesId: string;
  temperament: Temperament;
  individual: Individual;
  position: { x: number; y: number; z: number };
  facing: number;
  state: CreatureState;
  frameClock: number;
};
type WorldPosition = { x: number; z: number };
const MAX_WILD_CREATURES = 24;
const createCreatureRegistry = (
  heightAt: (x: number, z: number) => number,
  viewerPosition: () => WorldPosition = () => ({ x: 0, z: 0 }),
) => {
  const creatures = new Map<string, SpawnedCreature>();
  const add = (individual: Individual, x: number, z: number, facing = 0): SpawnedCreature => {
    if (!creatures.has(individual.id) && creatures.size >= MAX_WILD_CREATURES) {
      const viewer = viewerPosition();
      const furthest = [...creatures.values()].reduce((candidate, creature) =>
        Math.hypot(creature.position.x - viewer.x, creature.position.z - viewer.z) >
        Math.hypot(candidate.position.x - viewer.x, candidate.position.z - viewer.z)
          ? creature
          : candidate,
      );
      creatures.delete(furthest.id);
    }
    const creature = {
      id: individual.id,
      speciesId: individual.speciesId,
      temperament: individual.temperament,
      individual,
      position: { x, y: heightAt(x, z), z },
      facing,
      state: 'idle' as const,
      frameClock: 0,
    };
    creatures.set(creature.id, creature);
    return creature;
  };
  const remove = (id: string): void => {
    creatures.delete(id);
  };
  return {
    add,
    remove,
    get: (id: string) => creatures.get(id),
    list: (): readonly SpawnedCreature[] => [...creatures.values()],
    setState: (id: string, state: CreatureState) => {
      const c = creatures.get(id);
      if (c && c.state !== state) {
        c.state = state;
        c.frameClock = 0;
      }
    },
    update: (dt: number) => {
      for (const c of creatures.values()) {
        c.frameClock += Math.max(0, dt);
        c.position.y = heightAt(c.position.x, c.position.z);
      }
    },
    clear: () => creatures.clear(),
  };
};
export { MAX_WILD_CREATURES, createCreatureRegistry };
export type { CreatureState, SpawnedCreature };
