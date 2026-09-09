import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { CreatureModel, CreatureState } from './bodyplans/types.js';
import { createCreatureModels, stateFor, type CreatureEntry } from './creatures.js';

const entry = (overrides: Partial<CreatureEntry> = {}): CreatureEntry => ({
  key: 'one',
  speciesId: 'thornwren',
  tileX: 1.5,
  tileY: 2.5,
  facing: 0,
  state: 'idle',
  phaseOffset: 0,
  ...overrides,
});
const fakeBuilder = (records: CreatureModel[]) => () => {
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial());
  head.position.z = 0.5;
  const group = new THREE.Group();
  group.add(head);
  const model = { group, animate: vi.fn(), dispose: vi.fn() };
  records.push(model);
  return model;
};

describe('createCreatureModels', () => {
  it('turns a model to the creature facing', () => {
    const scene = new THREE.Scene(),
      records: CreatureModel[] = [];
    const models = createCreatureModels(scene, fakeBuilder(records));
    models.sync([entry({ facing: 1.25 })], 0);
    expect(records[0]!.group.rotation.y).toBe(1.25);
    records[0]!.group.rotation.y = 0;
    const box = new THREE.Box3().setFromObject(records[0]!.group.children[0]!);
    expect(box.max.z).toBeGreaterThan(0);
    models.dispose();
  });
  it('maps walk to the locomotion animation state', () => {
    expect(stateFor('walk')).toBe('locomotion');
    expect(stateFor('idle')).toBe('idle');
    expect(stateFor('execute')).toBe('execute');
    const scene = new THREE.Scene(),
      records: CreatureModel[] = [];
    createCreatureModels(scene, fakeBuilder(records)).sync([entry({ state: 'walk' })], 2);
    expect(records[0]!.animate).toHaveBeenCalledWith(2, 'locomotion' satisfies CreatureState, 0);
  });
  it('adds a model per creature and removes it when the creature is gone', () => {
    const scene = new THREE.Scene(),
      records: CreatureModel[] = [];
    const models = createCreatureModels(scene, fakeBuilder(records));
    models.sync([entry(), entry({ key: 'two' }), entry({ key: 'three' })], 0);
    expect(scene.children).toHaveLength(3);
    models.sync([entry()], 0);
    expect(scene.children).toHaveLength(1);
    expect(records[1]!.dispose).toHaveBeenCalledOnce();
    expect(records[2]!.dispose).toHaveBeenCalledOnce();
    models.dispose();
  });
  it('places a model at the creature continuous tile position', () => {
    const scene = new THREE.Scene(),
      records: CreatureModel[] = [];
    const models = createCreatureModels(scene, fakeBuilder(records));
    models.sync([entry({ tileX: 125.5, tileY: 225.5 })], 0);
    expect(records[0]!.group.position.toArray()).toEqual([125.5, 0, 225.5]);
    models.dispose();
  });
  it('lays a downed creature on its side and dims it', () => {
    const scene = new THREE.Scene(),
      records: CreatureModel[] = [];
    const models = createCreatureModels(scene, fakeBuilder(records));
    models.sync([entry({ downed: true })], 0);
    const model = records[0]!;
    const material = (model.group.children[0] as THREE.Mesh).material as THREE.Material;
    expect(model.group.rotation.z).toBe(Math.PI / 2);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(0.35);
    models.sync([entry({ downed: false })], 0);
    expect(model.group.rotation.z).toBe(0);
    expect(material.transparent).toBe(false);
    expect(material.opacity).toBe(1);
    models.dispose();
  });
});
