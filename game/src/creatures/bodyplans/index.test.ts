import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { species, speciesById } from '../species.js';
import { bodyPlanBuilders, buildBodyPlan } from './index.js';

const snapshot = (group: THREE.Group): number[][] => {
  group.updateMatrixWorld(true);
  const values: number[][] = [];
  group.traverse((object) =>
    values.push(object.matrixWorld.elements.map((value) => Number(value.toFixed(8)))),
  );
  return values;
};
const triangles = (group: THREE.Group): number => {
  let count = 0;
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const position = object.geometry.getAttribute('position');
    count += (object.geometry.index?.count ?? position.count) / 3;
  });
  return count;
};

describe('body plans', () => {
  it('maps every species through exactly eight builders', () => {
    expect(Object.keys(bodyPlanBuilders).sort()).toEqual(
      [
        'amphibious',
        'avian',
        'crawler',
        'heavy-quadruped',
        'large-biped',
        'light-quadruped',
        'serpentine',
        'shelled',
      ].sort(),
    );
    for (const data of species()) {
      const built = buildBodyPlan(data);
      let meshes = 0;
      built.group.traverse((object) => {
        if (object instanceof THREE.Mesh) meshes += 1;
      });
      expect(meshes, data.id).toBeGreaterThan(0);
      built.dispose();
    }
  });
  it('keeps every species within the geometry triangle budget', () => {
    let worst = { id: '', count: 0 };
    for (const data of species()) {
      const built = buildBodyPlan(data),
        count = triangles(built.group);
      if (count > worst.count) worst = { id: data.id, count };
      expect(count, `worst so far: ${worst.id} (${worst.count} triangles)`).toBeLessThanOrEqual(
        1500,
      );
      built.dispose();
    }
  });
  it('animates purely and produces distinct poses', () => {
    for (const data of species()) {
      const built = buildBodyPlan(data);
      built.animate(1, 'locomotion');
      const expected = snapshot(built.group);
      built.animate(0.2, 'idle', 1);
      built.animate(2, 'execute');
      built.animate(1, 'locomotion');
      expect(snapshot(built.group), data.id).toEqual(expected);
      built.animate(0, 'locomotion');
      const start = snapshot(built.group);
      built.animate(0.4, 'locomotion');
      expect(snapshot(built.group), `${data.id} locomotion`).not.toEqual(start);
      const moving = snapshot(built.group);
      built.animate(0.4, 'idle');
      expect(snapshot(built.group), `${data.id} states`).not.toEqual(moving);
      built.dispose();
    }
  });
  it('hovers and floats', () => {
    const bird = buildBodyPlan(speciesById('thornwren')!);
    bird.animate(0, 'idle');
    const idle = bird.group.children[0]!.position.y;
    bird.animate(0.5, 'locomotion');
    const hover = bird.group.children[0]!.position.y;
    expect(hover).toBeGreaterThan(idle);
    expect(hover).toBeGreaterThanOrEqual(2);
    expect(hover).toBeLessThanOrEqual(4);
    const swimmer = buildBodyPlan(speciesById('mirefin')!);
    swimmer.animate(1, 'idle', 0);
    const ground = swimmer.group.children[0]!.position.y;
    swimmer.animate(1, 'idle', 1.5);
    expect(swimmer.group.children[0]!.position.y).toBeGreaterThan(ground);
    bird.dispose();
    swimmer.dispose();
  });
  it('disposes each resource once and tolerates a second call', () => {
    const built = buildBodyPlan(species()[0]!);
    const spies: ReturnType<typeof vi.spyOn>[] = [];
    built.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        spies.push(vi.spyOn(object.geometry, 'dispose'));
        if (!Array.isArray(object.material)) spies.push(vi.spyOn(object.material, 'dispose'));
      }
    });
    built.dispose();
    built.dispose();
    spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  });
});
