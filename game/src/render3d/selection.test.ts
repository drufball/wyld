import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createSelection } from './selection.js';

describe('selection', () => {
  it('syncs the ring to the given tile and colour, and hides it when nothing is selected', () => {
    const scene = new THREE.Scene();
    const selection = createSelection(scene);
    const mesh = scene.children[0] as THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
    selection.sync({ tileX: 4, tileY: 7, colour: '#123456' });
    expect(mesh.visible).toBe(true);
    expect(mesh.position.x).toBe(4);
    expect(mesh.position.z).toBe(7);
    expect(mesh.material.color.getHexString()).toBe('123456');
    selection.sync(null);
    expect(mesh.visible).toBe(false);
    selection.dispose();
  });
});
