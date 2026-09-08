import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { paletteAt } from '../render2d/palette.js';
import { phases } from '../world/time.js';
import {
  ambientIntensityAt,
  groundSurfaceFor,
  skyAt,
  sunColourAt,
  sunIntensityAt,
  toColor,
} from './palette-bridge.js';
describe('palette bridge', () => {
  it('takes surface colours from the shared phase palette', () => {
    for (const p of phases) {
      const rgb = paletteAt(p, 0).grass.base;
      expect(toColor(rgb, new THREE.Color()).getHex()).toBe(
        new THREE.Color()
          .setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace)
          .getHex(),
      );
    }
  });
  it('lerps sky, sun and ambient between a phase and the next', () => {
    for (let i = 0; i < phases.length; i++) {
      const p = phases[i]!,
        n = phases[(i + 1) % 4]!;
      expect(skyAt(p, 1).getHex()).toBe(skyAt(n, 0).getHex());
      expect(sunColourAt(p, 1).getHex()).toBe(sunColourAt(n, 0).getHex());
      expect(sunIntensityAt(p, 1)).toBe(sunIntensityAt(n, 0));
      expect(ambientIntensityAt(p, 1)).toBe(ambientIntensityAt(n, 0));
    }
    expect(skyAt('Night', 0).getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(
      skyAt('Day', 0).getHSL({ h: 0, s: 0, l: 0 }).l,
    );
  });
  it('puts a tree tile on the biome ground surface, not on tree green', () => {
    expect(groundSurfaceFor({ class: 'cover', surface: 'tree', biome: 'forest' })).toBe('grass');
    expect(groundSurfaceFor({ class: 'cover', surface: 'rock', biome: 'volcano' })).toBe('ash');
    expect(groundSurfaceFor({ class: 'walkable', surface: 'fern', biome: 'forest' })).toBe('fern');
  });
});
