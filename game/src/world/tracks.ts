import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { species, speciesById, type TracksDescriptor } from '../creatures/species.js';
import type { Rng } from '../engine/rng.js';
import { regions, type Region } from './regions.js';

type TracksPlacement = {
  speciesId: string;
  regionId: string;
  x: number;
  z: number;
  y: number;
  rotationY: number;
  size: number;
};
type TrackProp = { kind: string; x: number; z: number };
type PlaceTracksOptions = {
  rng: Rng;
  propPlacements: readonly TrackProp[];
  heightAt(x: number, z: number): number;
  slopeAt(x: number, z: number): number;
  depthAt(x: number, z: number): number;
};

const inside = (region: Region, x: number, z: number): boolean =>
  Math.hypot(x - region.x, z - region.z) <= region.radius;
const nearestWater = (
  region: Region,
  origin: TrackProp,
  depthAt: PlaceTracksOptions['depthAt'],
): { x: number; z: number } | null => {
  let best: { x: number; z: number; distance: number } | null = null;
  // A fixed grid makes the search deterministic and avoids coupling it to the RNG stream.
  for (let x = region.x - region.radius; x <= region.x + region.radius; x += 5)
    for (let z = region.z - region.radius; z <= region.z + region.radius; z += 5) {
      if (!inside(region, x, z) || depthAt(x, z) <= 0) continue;
      const distance = Math.hypot(x - origin.x, z - origin.z);
      if (distance < (best?.distance ?? Number.POSITIVE_INFINITY)) best = { x, z, distance };
    }
  return best;
};

/** Pure deterministic placement. Tracks are evidence in the world, independent of clock phase. */
const placeTracks = (options: PlaceTracksOptions): TracksPlacement[] => {
  const { rng, propPlacements, heightAt, slopeAt, depthAt } = options;
  const placements: TracksPlacement[] = [];
  const regionById = new Map(regions().map((region) => [region.id, region]));
  // Kelpmaw's coil belongs inside the M5 grotto. Glasswing is rare and sighting-driven.
  const included = species().filter(
    (entry) => entry.rarity === 'standing' || entry.id === 'pyreclaw',
  );
  for (const entry of included) {
    const habitatIds =
      entry.id === 'pyreclaw'
        ? ['crater-rim']
        : [...new Set(entry.habitat.map(({ region }) => region))];
    const target = 4 + rng.int(5);
    let habitatOffset = 0;
    for (let index = 0; index < target; index += 1) {
      let placed = false;
      for (let regionTry = 0; regionTry < habitatIds.length && !placed; regionTry += 1) {
        const regionId = habitatIds[(index + habitatOffset + regionTry) % habitatIds.length]!;
        const region = regionById.get(regionId);
        if (!region) continue;
        const props = propPlacements.filter(
          (prop) => prop.kind !== 'fern' && inside(region, prop.x, prop.z),
        );
        for (let attempt = 0; attempt < 24 && !placed; attempt += 1) {
          const cover = props.length > 0 ? props[rng.int(props.length)]! : null;
          const water = cover ? nearestWater(region, cover, depthAt) : null;
          const alternatives = cover
            ? props.filter(
                (prop) => prop !== cover && Math.hypot(prop.x - cover.x, prop.z - cover.z) >= 8,
              )
            : [];
          const destination =
            water ?? (alternatives.length > 0 ? alternatives[rng.int(alternatives.length)]! : null);
          const direction = destination
            ? Math.atan2(destination.x - cover!.x, destination.z - cover!.z)
            : rng.range(0, Math.PI * 2);
          const distance = destination
            ? Math.hypot(destination.x - cover!.x, destination.z - cover!.z)
            : region.radius;
          if (distance === 0) continue;
          const fraction = destination ? rng.range(0.15, 0.85) : rng.range(0.2, 0.8);
          const origin = destination ? cover! : region;
          const jitter = destination ? rng.range(-2, 2) : 0;
          const dx = Math.sin(direction);
          const dz = Math.cos(direction);
          const x = origin.x + dx * distance * fraction - dz * jitter;
          const z = origin.z + dz * distance * fraction + dx * jitter;
          if (!inside(region, x, z) || slopeAt(x, z) >= 30 || depthAt(x, z) > 0) continue;
          const stride = entry.tracks.stride ?? 1;
          placements.push({
            speciesId: entry.id,
            regionId,
            x,
            z,
            y: heightAt(x, z),
            rotationY: direction,
            size: THREE.MathUtils.clamp(0.75 + stride * 0.9, 1.2, 3),
          });
          placed = true;
        }
      }
      if (!placed) habitatOffset += 1;
    }
  }
  return placements;
};

const ellipse = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
): void => {
  context.beginPath();
  context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  context.fill();
};
const drawPrint = (context: CanvasRenderingContext2D, x: number, y: number, toes: number): void => {
  ellipse(context, x, y, 7, 10);
  for (let toe = 0; toe < toes; toe += 1) {
    const spread = toes === 1 ? 0 : (toe / (toes - 1) - 0.5) * 18;
    ellipse(context, x + spread, y - 13 - Math.abs(spread) * 0.12, 2.5, 4);
  }
};
const drawTrackTexture = (tracks: TracksDescriptor): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  context.fillStyle = 'rgba(35,31,25,.72)';
  context.strokeStyle = 'rgba(35,31,25,.72)';
  context.lineWidth = 3;
  context.lineCap = 'round';
  if (tracks.kind === 'prints') {
    if (tracks.drag) {
      context.beginPath();
      context.moveTo(64, 238);
      context.lineTo(64, 18);
      context.stroke();
    }
    for (let row = 0; row < 4; row += 1)
      drawPrint(context, row % 2 === 0 ? 48 : 80, 225 - row * 62, tracks.toes ?? 3);
  } else if (tracks.kind === 'feather') {
    context.beginPath();
    context.moveTo(42, 225);
    context.quadraticCurveTo(67, 130, 82, 28);
    context.stroke();
    for (let y = 55; y < 205; y += 16) {
      const centre = 78 - (y - 55) * 0.15;
      context.beginPath();
      context.moveTo(centre, y);
      context.lineTo(centre - 34, y - 18);
      context.moveTo(centre + 2, y - 4);
      context.lineTo(centre + 34, y - 22);
      context.stroke();
    }
  } else if (tracks.kind === 'furrow' || tracks.kind === 'coil') {
    context.lineWidth = tracks.kind === 'furrow' ? 18 : 6;
    context.beginPath();
    context.moveTo(64, 244);
    context.bezierCurveTo(18, 190, 110, 130, 64, 78);
    context.bezierCurveTo(38, 48, 52, 22, 76, 20);
    context.stroke();
  } else {
    context.beginPath();
    context.moveTo(64, 22);
    context.lineTo(95, 100);
    context.lineTo(70, 92);
    context.lineTo(88, 225);
    context.lineTo(35, 128);
    context.lineTo(59, 133);
    context.closePath();
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const createTracksDecals = (placements: readonly TracksPlacement[]): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'tracks';
  const placementsBySpecies = new Map<string, TracksPlacement[]>();
  for (const placement of placements) {
    const grouped = placementsBySpecies.get(placement.speciesId) ?? [];
    grouped.push(placement);
    placementsBySpecies.set(placement.speciesId, grouped);
  }
  for (const [speciesId, speciesPlacements] of placementsBySpecies) {
    const definition = speciesById(speciesId);
    if (!definition) continue;
    const material = new THREE.MeshBasicMaterial({
      map: drawTrackTexture(definition.tracks),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide,
    });
    const geometries = speciesPlacements.map((placement) => {
      const geometry = new THREE.PlaneGeometry(placement.size, placement.size * 2);
      const transform = new THREE.Matrix4().compose(
        new THREE.Vector3(placement.x, placement.y + 0.02, placement.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, placement.rotationY)),
        new THREE.Vector3(1, 1, 1),
      );
      geometry.applyMatrix4(transform);
      return geometry;
    });
    const geometry = mergeGeometries(geometries, false);
    if (!geometry) throw new Error(`Could not merge ${speciesId} track geometry`);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `tracks-${speciesId}`;
    group.add(mesh);
  }
  return group;
};

export { createTracksDecals, placeTracks };
export type { PlaceTracksOptions, TracksPlacement };
