import { describe, expect, it } from 'vitest';

import type { Individual } from './individual.js';
import { MAX_WILD_CREATURES, createCreatureRegistry } from './registry2d.js';

const individual = (id: string): Individual => ({
  id,
  speciesId: 'thornwren',
  temperament: 'Skittish',
  stats: { vigor: 1, power: 1, speed: 1, focus: 1 },
  repertoire: [],
});

describe('createCreatureRegistry', () => {
  it('evicts the creature furthest from the player before exceeding the wild cap', () => {
    const registry = createCreatureRegistry(
      () => 0,
      () => ({ x: 0, z: 0 }),
    );
    for (let index = 0; index < MAX_WILD_CREATURES; index += 1)
      registry.add(individual(`wild-${index}`), index, 0);

    registry.add(individual('debug-spawn'), 2, 0);

    expect(registry.list()).toHaveLength(MAX_WILD_CREATURES);
    expect(registry.get(`wild-${MAX_WILD_CREATURES - 1}`)).toBeUndefined();
    expect(registry.get('debug-spawn')).toBeDefined();
  });
});
