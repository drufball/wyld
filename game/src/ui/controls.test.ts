import { describe, expect, it } from 'vitest';
import { buildControlRows } from './controls.js';

describe('controls card rows', () => {
  it('only includes the real debug control when the console is available', () => {
    const ordinary = buildControlRows(false);
    const debug = buildControlRows(true);
    expect(ordinary.map(([key]) => key)).toEqual([
      'W A S D',
      'Shift',
      'C',
      'Mouse',
      'G',
      'M',
      'Esc',
    ]);
    expect(debug.at(-1)).toEqual(['`', 'console']);
    expect(ordinary.flat().join(' ')).not.toMatch(/jump|attack|inventory/i);
  });
});
