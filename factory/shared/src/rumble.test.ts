import { describe, expect, it } from 'vitest';

import { Rumble } from './rumble.js';

const rumble = {
  id: 'rumble-1',
  title: 'Choose',
  context: 'A decision',
  options: ['A', 'B'],
  chosen: 'A',
  chosenAt: '2026-09-05T12:30:00Z',
  blockingQuestIds: ['quest-1'],
  kind: 'taste',
};

describe('Rumble', () => {
  it('parses a valid rumble', () => expect(Rumble.parse(rumble)).toEqual(rumble));
  it('rejects an invalid kind', () =>
    expect(Rumble.safeParse({ ...rumble, kind: 'color' }).success).toBe(false));
});
