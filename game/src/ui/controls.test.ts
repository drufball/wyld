import { describe, expect, it } from 'vitest';
import { buildControlRows } from './controls.js';
describe('controls card rows', () => {
  it('lists tap controls and gates the console', () => {
    expect(buildControlRows(false).map(([key]) => key)).toEqual([
      'Tap the ground',
      'Tap a creature',
      'Tap yourself',
      'Tap a wild creature',
      'Walk to an edge',
      '?',
    ]);
    expect(buildControlRows(true).at(-1)).toEqual(['`', 'console']);
  });
});
