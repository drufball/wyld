import { describe, expect, it } from 'vitest';

import { Demo, Feedback } from './demo.js';

const demo = {
  id: 'demo-1',
  questId: 'quest-1',
  ref: 'abc123',
  url: 'https://example.com/demo',
  builtAt: '2026-09-05T12:30:00Z',
  status: 'ready',
  screenshot: '/shots/demo.png',
};
const feedback = {
  id: 'feedback-1',
  demoId: 'demo-1',
  text: 'More trees',
  created: '2026-09-05T13:00:00Z',
};

describe('demo schemas', () => {
  it('parses demos and feedback', () => {
    expect(Demo.parse(demo)).toEqual(demo);
    expect(Feedback.parse(feedback)).toEqual(feedback);
  });
  it('rejects malformed demos and feedback', () => {
    expect(Demo.safeParse({ ...demo, url: 'not a URL' }).success).toBe(false);
    expect(Feedback.safeParse({ ...feedback, text: undefined }).success).toBe(false);
  });
});
