import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createRng } from '../engine/rng.js';
import { roll } from './individual.js';
import { createCreatureRegistry, spawnPoint } from './registry.js';
import { speciesById } from './species.js';
describe('creature registry', () => {
  it('places spawns ahead of the player and offsets them to the right', () => {
    const origin = new THREE.Vector3(-150, 2, 50);
    const quaternion = new THREE.Quaternion();
    expect(spawnPoint(origin, quaternion, 15, 0).toArray()).toEqual([-150, 2, 35]);
    expect(spawnPoint(origin, quaternion, 15, 4).toArray()).toEqual([-146, 2, 35]);
  });

  it('owns, updates, and removes creature models', () => {
    const scene = new THREE.Scene(),
      heightAt = vi.fn(() => 3),
      depthAt = vi.fn(() => 1.25),
      registry = createCreatureRegistry({ scene, heightAt, depthAt });
    const first = registry.add(roll(speciesById('loamox')!, createRng(1), 'one'), 2, 4, 0.5);
    expect(scene.children).toContain(first.model.group);
    expect(first.position.toArray()).toEqual([2, 3, 4]);
    expect(registry.list()).toEqual([first]);
    const animate = vi.spyOn(first.model, 'animate');
    registry.setState('one', 'execute');
    registry.update(2);
    expect(animate).toHaveBeenCalledWith(2, 'execute', 1.25);
    expect(depthAt).toHaveBeenCalledWith(2, 4);
    const dispose = vi.spyOn(first.model, 'dispose');
    registry.remove('one');
    expect(scene.children).not.toContain(first.model.group);
    expect(dispose).toHaveBeenCalledOnce();
    expect(registry.list()).toHaveLength(0);
    const second = registry.add(roll(speciesById('thornwren')!, createRng(2), 'two'), 0, 0);
    const secondDispose = vi.spyOn(second.model, 'dispose');
    registry.clear();
    expect(scene.children).not.toContain(second.model.group);
    expect(secondDispose).toHaveBeenCalledOnce();
  });
});
