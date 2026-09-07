import type { Rng } from '../engine/rng.js';
import type { BiomeWeights } from './terrain.js';

const propKinds = ['conifer', 'broadleaf', 'fern', 'rock', 'cactus', 'mesa', 'vent'] as const;
type PropKind = (typeof propKinds)[number];
type PropDensity = { density: number; scale: readonly number[] };
type PropDensities = Record<PropKind, PropDensity>;
type PropBounds = { minX: number; maxX: number; minZ: number; maxZ: number };
type PropPlacement = {
  kind: PropKind;
  x: number;
  z: number;
  y: number;
  rotationY: number;
  scale: number;
};
type PlacePropsOptions = {
  rng: Rng;
  heightAt(x: number, z: number): number;
  slopeAt(x: number, z: number): number;
  depthAt(x: number, z: number): number;
  biomeWeightsAt(x: number, z: number): BiomeWeights;
  densities: PropDensities;
  bounds: PropBounds;
};

const masks: Record<PropKind, readonly (keyof BiomeWeights)[]> = {
  conifer: ['forest'],
  broadleaf: ['forest'],
  fern: ['forest'],
  rock: ['forest', 'archipelago', 'volcano'],
  cactus: ['desert'],
  mesa: ['desert'],
  vent: ['volcano'],
};

/** Pure seeded rejection sampling; all environmental knowledge arrives as samplers. */
const placeProps = (options: PlacePropsOptions): PropPlacement[] => {
  const { rng, heightAt, slopeAt, depthAt, biomeWeightsAt, densities, bounds } = options;
  const area = (bounds.maxX - bounds.minX) * (bounds.maxZ - bounds.minZ);
  const placements: PropPlacement[] = [];
  for (const kind of propKinds) {
    const setting = densities[kind];
    const target = Math.round((setting.density * area) / 1000);
    let accepted = 0;
    for (let attempt = 0; attempt < target * 12 && accepted < target; attempt += 1) {
      const x = rng.range(bounds.minX, bounds.maxX);
      const z = rng.range(bounds.minZ, bounds.maxZ);
      const depth = depthAt(x, z);
      const weights = biomeWeightsAt(x, z);
      const biomeWeight = Math.max(...masks[kind].map((biome) => weights[biome]));
      const nearMesaRegions =
        Math.hypot(x - 250, z + 180) <= 90 || Math.hypot(x - 300, z + 60) <= 80;
      if (
        slopeAt(x, z) > 30 ||
        (kind === 'rock' ? depth > 0.2 : depth > 0) ||
        biomeWeight < 0.58 ||
        (kind === 'mesa' && !nearMesaRegions)
      )
        continue;
      placements.push({
        kind,
        x,
        z,
        y: heightAt(x, z),
        rotationY: rng.range(0, Math.PI * 2),
        scale: rng.range(setting.scale[0] ?? 1, setting.scale[1] ?? setting.scale[0] ?? 1),
      });
      accepted += 1;
    }
  }
  return placements;
};

export { placeProps, propKinds };
export type { PlacePropsOptions, PropBounds, PropDensities, PropDensity, PropKind, PropPlacement };
