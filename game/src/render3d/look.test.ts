import { describe, expect, it } from 'vitest';
import { lookFromQuery } from './look.js';
describe('lookFromQuery', () => {
  it('reads look=diorama and look=flat from the query string', () => {
    expect(lookFromQuery('?look=diorama')).toBe('diorama');
    expect(lookFromQuery('look=flat')).toBe('flat');
  });
  it('defaults missing or unknown looks to diorama', () => {
    expect(lookFromQuery('')).toBe('diorama');
    expect(lookFromQuery('?look=nope')).toBe('diorama');
  });
});
