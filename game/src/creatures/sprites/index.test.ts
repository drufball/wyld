import { describe, expect, it } from 'vitest';
import { species } from '../species.js';
import { generateSprite } from './index.js';
const plans = [
  'heavy-quadruped',
  'light-quadruped',
  'avian',
  'amphibious',
  'serpentine',
  'shelled',
  'crawler',
  'large-biped',
] as const;
describe('pixel creature sprites', () => {
  it('generates a sprite for each of the eight body plans', () => {
    for (const bodyPlan of plans) {
      const base = species().find((s) => s.bodyPlan === bodyPlan)!;
      expect(generateSprite(base, 'down', 'idle').grid.some(Boolean)).toBe(true);
    }
  });
  it('sizes sprites 16, 24 and 32 pixels by tier', () => {
    for (const tier of [1, 2, 3] as const) {
      const base = species().find((s) => s.tier === tier)!;
      expect(generateSprite(base, 'down', 'idle').width).toBe(
        tier === 1 ? 16 : tier === 2 ? 24 : 32,
      );
    }
  });
  it('produces byte-identical grids for the same species, facing and frame', () => {
    const base = species()[0]!;
    expect(generateSprite(base, 'side', 'walk0').grid).toEqual(
      generateSprite(base, 'side', 'walk0').grid,
    );
  });
  it('produces different grids for two species on the same body plan', () => {
    const pair = species()
      .filter((s) => s.bodyPlan === 'heavy-quadruped')
      .slice(0, 2);
    expect(generateSprite(pair[0]!, 'down', 'idle').grid).not.toEqual(
      generateSprite(pair[1]!, 'down', 'idle').grid,
    );
  });
  it('uses only palette indices that exist in the returned palette', () => {
    for (const base of species()) {
      const sprite = generateSprite(base, 'up', 'execute');
      expect(Math.max(...sprite.grid)).toBeLessThan(sprite.palette.length);
    }
  });
  it('leaves the grid empty outside the sprite silhouette', () => {
    for (const base of species()) {
      const sprite = generateSprite(base, 'down', 'idle');
      expect(sprite.grid[0]).toBe(0);
    }
  });
});
