import { describe, expect, it } from 'vitest';

import { NewRumble, Rumble, RumbleDecision } from './rumble.js';

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
  it('requires between one and four options', () => {
    expect(Rumble.safeParse({ ...pendingRumble, options: [] }).success).toBe(false);
    expect(Rumble.safeParse({ ...pendingRumble, options: ['1', '2', '3', '4', '5'] }).success).toBe(
      false,
    );
  });
  it('parses new rumbles with an optional id and default blocking quests', () => {
    const input = { title: 'Choose', context: 'A decision', options: ['Done'], kind: 'account' };
    expect(NewRumble.parse(input)).toEqual({ ...input, blockingQuestIds: [] });
    expect(NewRumble.parse({ ...input, id: 'account-choice' }).id).toBe('account-choice');
    expect(NewRumble.parse({ ...input, chosen: 'Done' }).chosen).toBe('Done');
    expect(NewRumble.safeParse({ ...input, chosen: 'Later' }).error?.issues[0]?.path).toEqual([
      'chosen',
    ]);
  });
  it('parses strict decisions', () => {
    expect(RumbleDecision.parse({ chosen: 'Done' })).toEqual({ chosen: 'Done' });
    expect(RumbleDecision.safeParse({ chosen: 'Done', extra: true }).success).toBe(false);
  });
});
