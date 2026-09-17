import { describe, expect, it } from 'vitest';
import { modelLimitFromError, modelLimitFromMessage } from './model-limit.js';

describe('model limit detection', () => {
  it('reads rejected events and epoch-second reset times', () => {
    expect(
      modelLimitFromMessage({
        type: 'rate_limit_event',
        rate_limit_info: { status: 'rejected', resetsAt: 1_799_949_600, extra: true },
      }),
    ).toEqual({ until: '2027-01-14T18:00:00.000Z' });
  });
  it('reads rejected events and epoch-millisecond reset times', () => {
    expect(
      modelLimitFromMessage({
        type: 'rate_limit_event',
        rate_limit_info: { status: 'rejected', resetsAt: 1_799_949_600_000 },
      }),
    ).toEqual({ until: '2027-01-14T18:00:00.000Z' });
  });
  it('treats a rejected event without a reset time as limited', () => {
    expect(
      modelLimitFromMessage({
        type: 'rate_limit_event',
        rate_limit_info: { status: 'rejected' },
      }),
    ).toEqual({});
  });
  it.each(['allowed', 'allowed_warning'])('ignores %s rate-limit events', (status) => {
    expect(
      modelLimitFromMessage({ type: 'rate_limit_event', rate_limit_info: { status } }),
    ).toBeNull();
  });
  it('matches the literal incident error', () => {
    expect(
      modelLimitFromError(
        `API Error: 429 {"type":"error","error":{"type":"rate_limit_error","message":"You've reached your Fable limit. Switch to another model or try again later."}}`,
      ),
    ).toEqual({});
  });
  it.each(['429 You have exceeded a secondary rate limit', 'Error: socket hang up'])(
    'does not mistake %s for a model limit',
    (error) => expect(modelLimitFromError(error)).toBeNull(),
  );
});
