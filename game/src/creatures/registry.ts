import * as THREE from 'three';

import { buildBodyPlan } from './bodyplans/index.js';
import type { CreatureModel, CreatureState } from './bodyplans/types.js';
import type { Individual } from './individual.js';
import { speciesById } from './species.js';
import type { Temperament } from './species.js';

type SpawnedCreature = {
  id: string;
  speciesId: string;
  temperament: Temperament;
  individual: Individual;
  model: CreatureModel;
  position: THREE.Vector3;
  state: CreatureState;
};
type CreatureRegistryOptions = {
  scene: THREE.Scene;
  heightAt(x: number, z: number): number;
  depthAt(x: number, z: number): number;
};

const createCreatureRegistry = ({ scene, heightAt, depthAt }: CreatureRegistryOptions) => {
  const creatures = new Map<string, SpawnedCreature>();
  const add = (individual: Individual, x: number, z: number, facingY = 0): SpawnedCreature => {
    const data = speciesById(individual.speciesId);
    if (!data) throw new Error(`Unknown species: ${individual.speciesId}`);
    const model = buildBodyPlan(data);
    model.group.position.set(x, heightAt(x, z), z);
    model.group.rotation.y = facingY;
    scene.add(model.group);
    const creature: SpawnedCreature = {
      id: individual.id,
      speciesId: individual.speciesId,
      temperament: individual.temperament,
      individual,
      model,
      position: model.group.position,
      state: 'idle',
    };
    creatures.set(creature.id, creature);
    return creature;
  };
  const remove = (id: string): void => {
    const creature = creatures.get(id);
    if (!creature) return;
    scene.remove(creature.model.group);
    creature.model.dispose();
    creatures.delete(id);
  };
  return {
    add,
    remove,
    get: (id: string) => creatures.get(id),
    list: (): readonly SpawnedCreature[] => [...creatures.values()],
    setState: (id: string, state: CreatureState): void => {
      const creature = creatures.get(id);
      if (creature) creature.state = state;
    },
    update: (elapsedSeconds: number): void => {
      creatures.forEach((creature) => {
        const { x, z } = creature.model.group.position;
        creature.model.group.position.y = heightAt(x, z);
        creature.model.animate(elapsedSeconds, creature.state, depthAt(x, z));
      });
    },
    clear: (): void => {
      [...creatures.keys()].forEach(remove);
    },
  };
};
export { createCreatureRegistry };
export type { CreatureRegistryOptions, SpawnedCreature };
