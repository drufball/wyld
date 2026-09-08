import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { TileGrid } from '../world/tiles.js';
import { createCover } from './cover.js';
describe('cover', () => {
  it('instances cover per part and never per tile', () => {
    const grid = {
      tileAt: (x: number, y: number) => {
        void y;
        return {
          class: 'cover',
          surface: x < 4 ? 'tree' : x === 4 ? 'rock' : 'grass',
          biome: 'forest',
        };
      },
    } as TileGrid;
    const counts = () => {
      const scene = new THREE.Scene(),
        cover = createCover(grid, scene);
      cover.build({ x: 0, y: 0 }, 8, 4);
      const result = scene.children
        .filter((x): x is THREE.InstancedMesh => x instanceof THREE.InstancedMesh)
        .map((x) => x.count);
      expect(result.length).toBeLessThanOrEqual(7);
      cover.dispose();
      return result;
    };
    expect(counts()).toEqual(counts());
  });
});
