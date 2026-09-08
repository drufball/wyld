import { describe, expect, it } from 'vitest';
import { lookFromQuery } from './look.js';
describe('lookFromQuery', () => {
  it('reads look=diorama and look=flat from the query string', () => {
    expect(lookFromQuery('?look=diorama')).toBe('diorama');
    expect(lookFromQuery('look=flat')).toBe('flat');
  });
  it('falls back to flat for a missing or unknown look', () => {
    expect(lookFromQuery('')).toBe('flat');
    expect(lookFromQuery('?look=nope')).toBe('flat');
  });
});
