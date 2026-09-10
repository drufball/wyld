import { describe, expect, it } from 'vitest';

import { emptyStringAsUndefined } from './env.js';

describe('emptyStringAsUndefined', () => {
  it("maps '' to undefined", () => {
    expect(emptyStringAsUndefined('')).toBeUndefined();
  });

  it("maps '   ' to undefined", () => {
    expect(emptyStringAsUndefined('   ')).toBeUndefined();
  });

  it("maps 'x' to 'x'", () => {
    expect(emptyStringAsUndefined('x')).toBe('x');
  });

  it('maps 0 to 0', () => {
    expect(emptyStringAsUndefined(0)).toBe(0);
  });

  it('maps undefined to undefined', () => {
    expect(emptyStringAsUndefined(undefined)).toBeUndefined();
  });
});
