import { describe, expect, it } from 'vitest';
import { buildControlRows } from './controls.js';
describe('controls card rows', () => {
  it('lists tap controls and gates the console', () => {
    expect(buildControlRows(false).map(([key]) => key)).toEqual([
      'Tap the ground',
      'Walk to an edge',
      'G',
      'M',
      '?',
    ]);
    expect(buildControlRows(true).at(-1)).toEqual(['`', 'console']);
  });
});
