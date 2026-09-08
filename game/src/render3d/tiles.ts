import * as THREE from 'three';
import { groundSurfaceFor, toColor } from './palette-bridge.js';
import type { Palette } from '../render2d/palette.js';
import type { Surface, TileGrid } from '../world/tiles.js';
type Screen = { x: number; y: number };
const createSlabs = (grid: TileGrid, scene: THREE.Scene) => {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const meshes = new Map<Surface, THREE.InstancedMesh>();
  let water: THREE.Mesh | null = null;
  let currentPalette: Palette | null = null;
  const clear = () => {
    for (const mesh of meshes.values()) {
      scene.remove(mesh);
      (mesh.material as THREE.Material).dispose();
    }
    meshes.clear();
    if (water) {
      scene.remove(water);
      water.geometry.dispose();
      (water.material as THREE.Material).dispose();
      water = null;
    }
  };
  const build = (screen: Screen | readonly Screen[], cols: number, rows: number) => {
    clear();
    const screens = Array.isArray(screen) ? screen : [screen];
    const coords = new Map<string, { tx: number; ty: number }>();
    for (const s of screens)
      for (let ty = s.y * rows - 1; ty <= (s.y + 1) * rows; ty++)
        for (let tx = s.x * cols - 1; tx <= (s.x + 1) * cols; tx++)
          coords.set(`${tx},${ty}`, { tx, ty });
    const grouped = new Map<Surface, { tx: number; ty: number }[]>();
    for (const p of coords.values()) {
      const surface = groundSurfaceFor(grid.tileAt(p.tx, p.ty));
      const list = grouped.get(surface) ?? [];
      list.push(p);
      grouped.set(surface, list);
    }
    const matrix = new THREE.Matrix4(),
      position = new THREE.Vector3(),
      scale = new THREE.Vector3(),
      colour = new THREE.Color();
    for (const [surface, points] of grouped) {
      const material = new THREE.MeshLambertMaterial({ flatShading: true });
      const mesh = new THREE.InstancedMesh(geometry, material, points.length);
      points.forEach(({ tx, ty }, index) => {
        const topY = surface === 'water' ? -0.3 : surface === 'cliff' ? 0.6 : 0;
        const depth = surface === 'water' ? 0.7 : surface === 'cliff' ? 1.6 : 0.5;
        matrix.compose(
          position.set(tx + 0.5, topY - depth / 2, ty + 0.5),
          new THREE.Quaternion(),
          scale.set(1, depth, 1),
        );
        mesh.setMatrixAt(index, matrix);
        if (currentPalette) mesh.setColorAt(index, toColor(currentPalette[surface].base, colour));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.userData.surface = surface;
      meshes.set(surface, mesh);
      scene.add(mesh);
    }
    if (grouped.has('water')) {
      const minX = Math.min(...screens.map((s) => s.x * cols)) - 1,
        maxX = Math.max(...screens.map((s) => (s.x + 1) * cols)) + 1;
      const minZ = Math.min(...screens.map((s) => s.y * rows)) - 1,
        maxZ = Math.max(...screens.map((s) => (s.y + 1) * rows)) + 1;
      const material = new THREE.MeshLambertMaterial({
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      water = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ), material);
      water.rotation.x = -Math.PI / 2;
      water.position.set((minX + maxX) / 2, -0.02, (minZ + maxZ) / 2);
      scene.add(water);
    }
  };
  const recolour = (palette: Palette) => {
    currentPalette = palette;
    const colour = new THREE.Color();
    for (const [surface, mesh] of meshes) {
      for (let i = 0; i < mesh.count; i++)
        mesh.setColorAt(i, toColor(palette[surface].base, colour));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    if (water)
      (water.material as THREE.MeshLambertMaterial).color.copy(
        toColor(palette.water.detail, colour),
      );
  };
  return {
    build,
    recolour,
    dispose() {
      clear();
      geometry.dispose();
    },
  };
};
export { createSlabs };
