import { describe, expect, it } from 'vitest';

import { FACTORY_NAME } from './index.js';

describe('FACTORY_NAME', () => {
  it('names the software factory', () => {
    expect(FACTORY_NAME).toBe('Expansion Pak');
  });
});
