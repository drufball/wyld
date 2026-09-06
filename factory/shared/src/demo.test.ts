import { describe, expect, expectTypeOf, it } from 'vitest';

import { Demo, DemoKind, Feedback, NewDemo, NewFeedback, type Demo as DemoType } from './demo.js';

const demo = {
  id: 'demo-1',
  questId: 'quest-1',
  title: 'Demo one',
  ref: 'abc123',
  url: '/play/demo-1/',
  kind: 'disc',
  summary: null,
  steps: [],
  seeded: [],
  deepLink: null,
  builtAt: '2026-09-05T12:30:00Z',
  status: 'ready',
  error: null,
};
const feedback = {
  id: 1,
  demoId: 'demo-1',
  questId: 'quest-1',
  text: 'More trees',
  state: { level: 2 },
  hasScreenshot: false,
  created: '2026-09-05T13:00:00Z',
};

describe('demo schemas', () => {
  it('parses demos and feedback', () => {
    expect(Demo.parse(demo)).toEqual(demo);
    expect(DemoKind.options).toEqual(['disc', 'live', 'pak']);
    expect(Feedback.parse(feedback)).toEqual(feedback);
    expect(NewDemo.parse({ id: 'main', ref: 'main' })).toEqual({ id: 'main', ref: 'main' });
    expect(NewFeedback.parse({ demoId: 'main', text: 'Nice' })).toMatchObject({ text: 'Nice' });
  });
  it('exports required card fields on the parsed Demo type', () => {
    expectTypeOf<DemoType>().toMatchTypeOf<{
      kind: 'disc' | 'live' | 'pak';
      summary: string | null;
      steps: string[];
      seeded: string[];
      deepLink: string | null;
    }>();
  });
  it('rejects malformed demos and feedback', () => {
    expect(Demo.safeParse({ ...demo, status: 'unknown' }).success).toBe(false);
    expect(Feedback.safeParse({ ...feedback, id: -1 }).success).toBe(false);
    expect(NewDemo.safeParse({ id: 'main', ref: '' }).success).toBe(false);
    expect(NewDemo.safeParse({ id: 'main', ref: '--upload-pack=evil' }).success).toBe(false);
    expect(NewFeedback.safeParse({ demoId: 'main', text: '' }).success).toBe(false);
  });
});
