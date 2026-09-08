import * as THREE from 'three';
import { toColor } from './palette-bridge.js';
import type { Palette } from '../render2d/palette.js';
import type { TileGrid } from '../world/tiles.js';
type Screen = { x: number; y: number };
type Part = {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshLambertMaterial;
  mesh?: THREE.InstancedMesh;
};
const createCover = (grid: TileGrid, scene: THREE.Scene) => {
  const parts: Part[] = [];
  const add = (geometry: THREE.BufferGeometry) => {
    const p = { geometry, material: new THREE.MeshLambertMaterial({ flatShading: true }) };
    parts.push(p);
    return p;
  };
  const trunk = add(new THREE.CylinderGeometry(0.08, 0.11, 0.5));
  const coniferLow = add(new THREE.ConeGeometry(0.42, 0.75));
  const coniferHigh = add(new THREE.ConeGeometry(0.3, 0.6));
  const crown = add(new THREE.IcosahedronGeometry(0.45, 0));
  const rock = add(new THREE.DodecahedronGeometry(0.5, 0));
  const fernA = add(new THREE.IcosahedronGeometry(0.3, 0));
  const fernB = add(new THREE.IcosahedronGeometry(0.2, 0));
  let palette: Palette | null = null;
  const clear = () =>
    parts.forEach((p) => {
      if (p.mesh) {
        scene.remove(p.mesh);
        p.mesh.dispose();
      }
      p.mesh = undefined;
    });
  const hashFor = (tx: number, ty: number) => ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
  const build = (screen: Screen | readonly Screen[], cols: number, rows: number) => {
    clear();
    const screens = Array.isArray(screen) ? screen : [screen];
    const coords = new Map<string, { tx: number; ty: number }>();
    for (const s of screens)
      for (let ty = s.y * rows - 2; ty <= (s.y + 1) * rows + 1; ty++)
        for (let tx = s.x * cols - 2; tx <= (s.x + 1) * cols + 1; tx++)
          coords.set(`${tx},${ty}`, { tx, ty });
    const placements = new Map<Part, THREE.Matrix4[]>();
    parts.forEach((p) => placements.set(p, []));
    const put = (
      part: Part,
      tx: number,
      ty: number,
      y: number,
      scale = new THREE.Vector3(1, 1, 1),
      rotation = new THREE.Euler(),
    ) => {
      placements
        .get(part)!
        .push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(tx + 0.5, y, ty + 0.5),
            new THREE.Quaternion().setFromEuler(rotation),
            scale,
          ),
        );
    };
    for (const { tx, ty } of coords.values()) {
      const surface = grid.tileAt(tx, ty).surface;
      let hash = hashFor(tx, ty);
      const advance = () => (hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0);
      if (surface === 'tree') {
        const kind = hash & 1;
        const jv = [advance(), advance()];
        const jr = (v: number, a: number, b: number) => a + (v / 0xffffffff) * (b - a);
        const s = jr(jv[0]!, 0.82, 1.18);
        const scale = new THREE.Vector3(s, s, s);
        const yaw = new THREE.Euler(0, jr(jv[1]!, 0, Math.PI * 2), 0);
        put(trunk, tx, ty, 0.25 * s, scale, yaw);
        if (kind) {
          put(coniferLow, tx, ty, 0.75 * s, scale, yaw);
          put(coniferHigh, tx, ty, 1.25 * s, scale, yaw);
        } else put(crown, tx, ty, 1.05 * s, scale, yaw);
      } else if (surface === 'rock') {
        const values = [advance(), advance(), advance(), advance(), advance(), advance()];
        const range = (v: number, a: number, b: number) => a + (v / 0xffffffff) * (b - a);
        const sx = range(values[0]!, 0.45, 0.75),
          sy = range(values[1]!, 0.45, 0.75),
          sz = range(values[2]!, 0.45, 0.75);
        put(
          rock,
          tx,
          ty,
          sy / 2,
          new THREE.Vector3(sx, sy, sz),
          new THREE.Euler(
            range(values[4]!, -0.12, 0.12),
            range(values[3]!, 0, Math.PI * 2),
            range(values[5]!, -0.12, 0.12),
          ),
        );
      } else if (surface === 'fern') {
        const fv = [advance(), advance(), advance()];
        const fr = (v: number, a: number, b: number) => a + (v / 0xffffffff) * (b - a);
        const yaw = new THREE.Euler(0, fr(fv[2]!, 0, Math.PI * 2), 0);
        put(
          fernA,
          tx,
          ty,
          0.16,
          new THREE.Vector3(fr(fv[0]!, 0.8, 1.2), 0.55, fr(fv[1]!, 0.8, 1.2)),
          yaw,
        );
        put(fernB, tx, ty, 0.24, new THREE.Vector3(1, 0.6, 1), yaw);
      }
    }
    for (const part of parts) {
      const matrices = placements.get(part)!;
      if (!matrices.length) continue;
      part.mesh = new THREE.InstancedMesh(part.geometry, part.material, matrices.length);
      matrices.forEach((m, i) => part.mesh!.setMatrixAt(i, m));
      part.mesh.instanceMatrix.needsUpdate = true;
      part.mesh.computeBoundingSphere();
      part.mesh.frustumCulled = false;
      part.mesh.castShadow = true;
      part.mesh.receiveShadow = false;
      scene.add(part.mesh);
    }
    if (palette) recolour(palette);
  };
  const recolour = (next: Palette) => {
    palette = next;
    const set = (p: Part, rgb: readonly [number, number, number]) =>
      p.material.color.copy(toColor(rgb, new THREE.Color()));
    set(trunk, next.tree.shade);
    set(coniferLow, next.tree.base);
    set(coniferHigh, next.tree.base);
    set(crown, next.tree.detail);
    set(rock, next.rock.base);
    set(fernA, next.fern.shade);
    set(fernB, next.fern.detail);
  };
  return {
    build,
    recolour,
    dispose() {
      clear();
      parts.forEach((p) => {
        p.geometry.dispose();
        p.material.dispose();
      });
    },
  };
};
export { createCover };
