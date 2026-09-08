import type * as THREE from 'three';
import { speciesById } from '../creatures/species.js';
import { buildBodyPlan } from './bodyplans/index.js';
import type { CreatureModel, CreatureState } from './bodyplans/types.js';

type CreatureEntry = {
  key: string;
  speciesId: string;
  tileX: number;
  tileY: number;
  facing: number;
  state: 'idle' | 'walk' | 'execute';
  phaseOffset: number;
};
type ModelBuilder = typeof buildBodyPlan;
const stateFor = (state: CreatureEntry['state']): CreatureState =>
  state === 'walk' ? 'locomotion' : state;
const createCreatureModels = (scene: THREE.Scene, builder: ModelBuilder = buildBodyPlan) => {
  const models = new Map<string, CreatureModel>();
  const remove = (key: string, model: CreatureModel) => {
    scene.remove(model.group);
    model.dispose();
    models.delete(key);
  };
  return {
    sync(entries: readonly CreatureEntry[], elapsedSeconds: number) {
      const present = new Set(entries.map(({ key }) => key));
      for (const [key, model] of models) if (!present.has(key)) remove(key, model);
      for (const entry of entries) {
        let model = models.get(entry.key);
        if (!model) {
          const data = speciesById(entry.speciesId);
          if (!data) continue;
          model = builder(data, data.tier);
          models.set(entry.key, model);
          scene.add(model.group);
        }
        model.group.position.set(entry.tileX, 0, entry.tileY);
        model.group.rotation.y = entry.facing;
        model.animate(elapsedSeconds + entry.phaseOffset, stateFor(entry.state), 0);
      }
    },
    dispose() {
      for (const [key, model] of [...models]) remove(key, model);
    },
  };
};
export { createCreatureModels, stateFor };
export type { CreatureEntry };
