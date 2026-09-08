import * as THREE from 'three';
import { paletteAt, paletteKey } from '../render2d/palette.js';
import type { Surface, Tile } from '../world/tiles.js';
import { phases, type Phase } from '../world/time.js';

type Lighting = {
  sky: string;
  sun: string;
  ambient: string;
  sunIntensity: number;
  ambientIntensity: number;
};
const authored: Record<Phase, Lighting> = {
  Dawn: {
    sky: '#e9c49a',
    sun: '#ffd9b0',
    ambient: '#ffe2c4',
    sunIntensity: 1.6,
    ambientIntensity: 1.1,
  },
  Day: {
    sky: '#bcd9ea',
    sun: '#fff6e2',
    ambient: '#dceaf7',
    sunIntensity: 2.0,
    ambientIntensity: 1.3,
  },
  Dusk: {
    sky: '#c98f6e',
    sun: '#ffb27a',
    ambient: '#f0c4a8',
    sunIntensity: 1.5,
    ambientIntensity: 1.1,
  },
  Night: {
    sky: '#1b2436',
    sun: '#9fb4e2',
    ambient: '#8ea6d8',
    sunIntensity: 1.0,
    ambientIntensity: 1.5,
  },
};
const mix = (phase: Phase, progress: number, field: 'sky' | 'sun' | 'ambient') => {
  const t = Math.max(0, Math.min(1, progress));
  const next = phases[(phases.indexOf(phase) + 1) % phases.length]!;
  return new THREE.Color(authored[phase][field]).lerp(new THREE.Color(authored[next][field]), t);
};
const mixNumber = (phase: Phase, progress: number, field: 'sunIntensity' | 'ambientIntensity') => {
  const t = Math.max(0, Math.min(1, progress));
  const next = phases[(phases.indexOf(phase) + 1) % phases.length]!;
  return authored[phase][field] + (authored[next][field] - authored[phase][field]) * t;
};
const toColor = (rgb: readonly [number, number, number], out: THREE.Color): THREE.Color =>
  out.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
const skyAt = (phase: Phase, progress: number) => mix(phase, progress, 'sky');
const sunColourAt = (phase: Phase, progress: number) => mix(phase, progress, 'sun');
const ambientColourAt = (phase: Phase, progress: number) => mix(phase, progress, 'ambient');
const sunIntensityAt = (phase: Phase, progress: number) =>
  mixNumber(phase, progress, 'sunIntensity');
const ambientIntensityAt = (phase: Phase, progress: number) =>
  mixNumber(phase, progress, 'ambientIntensity');
const groundSurfaceFor = (tile: Tile): Surface => {
  if (tile.surface !== 'tree' && tile.surface !== 'rock' && tile.surface !== 'fern')
    return tile.surface;
  return { forest: 'grass', desert: 'sand', archipelago: 'sand', volcano: 'ash' }[
    tile.biome
  ] as Surface;
};
const surfacePaletteAt = (phase: Phase, progress: number) => paletteAt(phase, progress);
const surfacePaletteKey = (phase: Phase, progress: number) => paletteKey(phase, progress);
export {
  ambientColourAt,
  ambientIntensityAt,
  groundSurfaceFor,
  skyAt,
  sunColourAt,
  sunIntensityAt,
  surfacePaletteAt,
  surfacePaletteKey,
  toColor,
};
