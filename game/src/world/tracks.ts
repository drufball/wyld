import { species } from '../creatures/species.js';
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
  isWalkable?(x: number, z: number): boolean;
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
  const { rng, propPlacements, heightAt, slopeAt, depthAt, isWalkable = () => true } = options;
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
          if (
            !inside(region, x, z) ||
            slopeAt(x, z) >= 30 ||
            depthAt(x, z) > 0 ||
            !isWalkable(x, z)
          )
            continue;
          const stride = entry.tracks.stride ?? 1;
          placements.push({
            speciesId: entry.id,
            regionId,
            x,
            z,
            y: heightAt(x, z),
            rotationY: direction,
            size: Math.max(1.2, Math.min(3, 0.75 + stride * 0.9)),
          });
          placed = true;
        }
      }
      if (!placed) habitatOffset += 1;
    }
  }
  return placements;
};

export { placeTracks };
export type { PlaceTracksOptions, TracksPlacement, TrackProp };
