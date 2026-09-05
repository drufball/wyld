import { describe, expect, it } from 'vitest';

import { Rumble } from './rumble.js';

const pendingRumble = {
  id: 'rumble-1',
  title: 'Choose',
  context: 'A decision',
  options: ['A', 'B'],
  chosen: null,
  chosenAt: null,
  blockingQuestIds: ['quest-1'],
  kind: 'taste',
};

describe('Rumble', () => {
  it('parses pending and decided rumbles', () => {
    expect(Rumble.parse(pendingRumble)).toEqual(pendingRumble);
    expect(
      Rumble.parse({
        ...pendingRumble,
        chosen: 'A',
        chosenAt: '2026-09-05T12:30:00Z',
      }),
    ).toMatchObject({ chosen: 'A', chosenAt: '2026-09-05T12:30:00Z' });
  });
  it('rejects an invalid kind', () =>
    expect(Rumble.safeParse({ ...pendingRumble, kind: 'color' }).success).toBe(false));
});
