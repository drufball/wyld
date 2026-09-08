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
  downed?: boolean;
};
type ModelBuilder = typeof buildBodyPlan;
const stateFor = (state: CreatureEntry['state']): CreatureState =>
  state === 'walk' ? 'locomotion' : state;
const createCreatureModels = (scene: THREE.Scene, builder: ModelBuilder = buildBodyPlan) => {
  const models = new Map<string, CreatureModel>();
  const dimmed = new Map<
    string,
    { material: THREE.Material; transparent: boolean; opacity: number }[]
  >();
  const remove = (key: string, model: CreatureModel) => {
    scene.remove(model.group);
    model.dispose();
    models.delete(key);
    dimmed.delete(key);
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
        model.group.rotation.z = entry.downed ? Math.PI / 2 : 0;
        const saved = dimmed.get(entry.key);
        if (entry.downed && !saved) {
          const materials = new Set<THREE.Material>();
          model.group.traverse((object) => {
            if (!(object as THREE.Mesh).isMesh) return;
            const material = (object as THREE.Mesh).material;
            for (const item of Array.isArray(material) ? material : [material]) materials.add(item);
          });
          const originals = [...materials].map((material) => ({
            material,
            transparent: material.transparent,
            opacity: material.opacity,
          }));
          for (const { material } of originals) {
            material.transparent = true;
            material.opacity = 0.35;
          }
          dimmed.set(entry.key, originals);
        } else if (!entry.downed && saved) {
          for (const original of saved) {
            original.material.transparent = original.transparent;
            original.material.opacity = original.opacity;
          }
          dimmed.delete(entry.key);
        }
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
