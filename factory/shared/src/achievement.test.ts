import { describe, expect, it } from 'vitest';
import { Achievement } from './achievement.js';

const base = { id: 'first', name: 'First', description: 'Did it.', badge: '✨' };

describe('Achievement', () => {
  it('accepts locked and unlocked achievements', () => {
    expect(Achievement.parse({ ...base, unlockedAt: null }).unlockedAt).toBeNull();
    expect(
      Achievement.parse({ ...base, unlockedAt: '2026-09-06T06:30:00.000Z' }).unlockedAt,
    ).toBeTruthy();
  });

  it('requires a badge', () => {
    expect(() => Achievement.parse({ ...base, badge: undefined, unlockedAt: null })).toThrow();
  });
});
