import * as THREE from 'three';
import { species as allSpecies, type SpeciesData } from '../../creatures/species.js';
import { cameraOffset } from '../camera.js';
import { buildBodyPlan } from './index.js';

export const TURNAROUND_YAWS = {
  front: 0,
  side: Math.PI / 2,
  back: Math.PI,
  threeQuarter: (3 * Math.PI) / 4,
} as const;
export const PIXELS_PER_TILE = 160;
const CANVAS_SIZE = PIXELS_PER_TILE * 5;

export type Silhouette = {
  width: number;
  height: number;
  area: number;
  headArea: number | null;
};
export type Turnaround = Record<keyof typeof TURNAROUND_YAWS, Silhouette>;

const dioramaCamera = (): THREE.OrthographicCamera => {
  const camera = new THREE.OrthographicCamera(-2.5, 2.5, 2.5, -2.5, 1, 400);
  const offset = cameraOffset(200);
  camera.position.set(offset.x, offset.y, offset.z);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
};

const edge = (ax: number, ay: number, bx: number, by: number, px: number, py: number) =>
  (px - ax) * (by - ay) - (py - ay) * (bx - ax);

const rasterise = (group: THREE.Object3D, onlyHeads: boolean): Uint8Array => {
  const coverage = new Uint8Array(CANVAS_SIZE * CANVAS_SIZE);
  const camera = dioramaCamera();
  const viewProjection = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  );
  const vertices = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || (onlyHeads && object.name !== 'head')) return;
    const position = object.geometry.getAttribute('position');
    const index = object.geometry.index;
    const triangleCount = Math.floor((index?.count ?? position.count) / 3);
    const matrix = new THREE.Matrix4().multiplyMatrices(viewProjection, object.matrixWorld);
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      for (let corner = 0; corner < 3; corner += 1) {
        const vertexIndex = index?.getX(triangle * 3 + corner) ?? triangle * 3 + corner;
        vertices[corner]!.fromBufferAttribute(
          position as THREE.BufferAttribute,
          vertexIndex,
        ).applyMatrix4(matrix);
      }
      const points = vertices.map(({ x, y }) => ({
        x: ((x + 1) * CANVAS_SIZE) / 2,
        y: ((1 - y) * CANVAS_SIZE) / 2,
      }));
      const minX = Math.max(0, Math.floor(Math.min(...points.map(({ x }) => x))));
      const maxX = Math.min(CANVAS_SIZE - 1, Math.ceil(Math.max(...points.map(({ x }) => x))));
      const minY = Math.max(0, Math.floor(Math.min(...points.map(({ y }) => y))));
      const maxY = Math.min(CANVAS_SIZE - 1, Math.ceil(Math.max(...points.map(({ y }) => y))));
      const winding = edge(
        points[0]!.x,
        points[0]!.y,
        points[1]!.x,
        points[1]!.y,
        points[2]!.x,
        points[2]!.y,
      );
      if (winding === 0) continue;
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const signs = [
            edge(points[0]!.x, points[0]!.y, points[1]!.x, points[1]!.y, x + 0.5, y + 0.5),
            edge(points[1]!.x, points[1]!.y, points[2]!.x, points[2]!.y, x + 0.5, y + 0.5),
            edge(points[2]!.x, points[2]!.y, points[0]!.x, points[0]!.y, x + 0.5, y + 0.5),
          ];
          if (signs.every((value) => value >= 0) || signs.every((value) => value <= 0))
            coverage[y * CANVAS_SIZE + x] = 1;
        }
      }
    }
  });
  return coverage;
};

const bounds = (coverage: Uint8Array) => {
  let minX = CANVAS_SIZE,
    minY = CANVAS_SIZE,
    maxX = -1,
    maxY = -1,
    area = 0;
  coverage.forEach((filled, offset) => {
    if (!filled) return;
    const x = offset % CANVAS_SIZE,
      y = Math.floor(offset / CANVAS_SIZE);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    area += 1;
  });
  return { width: area ? maxX - minX + 1 : 0, height: area ? maxY - minY + 1 : 0, area };
};

export const measureObjectSilhouette = (group: THREE.Object3D): Silhouette => {
  group.updateMatrixWorld(true);
  return { ...bounds(rasterise(group, false)), headArea: null };
};

export const measureSilhouette = (species: SpeciesData, yaw: number): Silhouette => {
  const model = buildBodyPlan(species, species.tier);
  model.animate(0, 'idle', 0);
  model.group.rotation.y = yaw;
  model.group.updateMatrixWorld(true);
  const hasHead = model.group
    .getObjectsByProperty('name', 'head')
    .some((item) => item instanceof THREE.Mesh);
  const result = {
    ...bounds(rasterise(model.group, false)),
    headArea: hasHead ? bounds(rasterise(model.group, true)).area : null,
  };
  model.dispose();
  return result;
};

export const measureTurnaround = (species: SpeciesData): Turnaround =>
  Object.fromEntries(
    Object.entries(TURNAROUND_YAWS).map(([angle, yaw]) => [angle, measureSilhouette(species, yaw)]),
  ) as Turnaround;

export const isThin = (turnaround: Turnaround): { thin: boolean; reasons: string[] } => {
  const reasons: string[] = [];
  const widthRatio = turnaround.side.width / turnaround.front.width;
  const areaRatio = turnaround.side.area / turnaround.front.area;
  if (widthRatio < 0.45) reasons.push(`side width ${widthRatio.toFixed(2)} of front`);
  if (areaRatio < 0.55) reasons.push(`side area ${areaRatio.toFixed(2)} of front`);
  if (turnaround.side.headArea !== null && turnaround.front.headArea !== null) {
    const headRatio = turnaround.side.headArea / turnaround.front.headArea;
    if (headRatio < 0.5) reasons.push(`side head area ${headRatio.toFixed(2)} of front`);
  }
  return { thin: reasons.length > 0, reasons };
};

export const formatTurnaroundTable = (rows: Record<string, Turnaround>): string => {
  const lines = [
    '| Species | Angle | Width px | Height px | Area px | Head px | Thin? |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- |',
  ];
  for (const data of allSpecies()) {
    const turnaround = rows[data.id];
    if (!turnaround) continue;
    const assessment = isThin(turnaround);
    for (const [angle, silhouette] of Object.entries(turnaround)) {
      const thin =
        angle === 'side' && assessment.thin ? `yes — ${assessment.reasons.join('; ')}` : '—';
      lines.push(
        `| ${data.name} | ${angle === 'threeQuarter' ? 'three-quarter' : angle} | ${silhouette.width} | ${silhouette.height} | ${silhouette.area} | ${silhouette.headArea ?? '—'} | ${thin} |`,
      );
    }
  }
  return lines.join('\n');
};
