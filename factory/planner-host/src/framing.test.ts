import { describe, expect, it } from 'vitest';
import { renderBatch, renderChannelTag } from './framing.js';
import type { QueuedMessage } from './queue.js';

const message = (override: Partial<QueuedMessage> = {}): QueuedMessage => ({
  id: 1,
  source: 'github',
  kind: 'github.ci_completed',
  summary: 'CI success on main',
  ts: '2026-09-05T15:37:04Z',
  ...override,
});

describe('channel framing', () => {
  it.each([
    [
      message({ url: 'https://github.com/drufball/wyld/actions/runs/33975262774' }),
      '<channel source="wake" kind="github.ci_completed" ts="2026-09-05T15:37:04Z" source="github" url="https://github.com/drufball/wyld/actions/runs/33975262774">\nCI success on main\n</channel>',
    ],
    [
      message({
        ts: '2026-09-05T15:43:59Z',
        pr: 32,
        summary: 'CI success on codex/pak-polish (+1 earlier updates)',
      }),
      '<channel source="wake" kind="github.ci_completed" ts="2026-09-05T15:43:59Z" source="github" pr="32">\nCI success on codex/pak-polish (+1 earlier updates)\n</channel>',
    ],
    [
      message({
        kind: 'github.issue_closed',
        ts: '2026-09-05T15:44:57Z',
        quest: 'pak-polish',
        issue: 28,
        url: 'https://github.com/drufball/wyld/issues/28',
        summary: '...',
      }),
      '<channel source="wake" kind="github.issue_closed" ts="2026-09-05T15:44:57Z" source="github" quest="pak-polish" issue="28" url="https://github.com/drufball/wyld/issues/28">\n...\n</channel>',
    ],
    [
      message({
        source: 'human',
        kind: 'human.ask',
        ts: '2026-09-05T15:30:03.811Z',
        quest: 'bootstrap',
        summary: 'Ask on bootstrap: Is this quest done?',
      }),
      '<channel source="wake" kind="human.ask" ts="2026-09-05T15:30:03.811Z" source="human" quest="bootstrap">\nAsk on bootstrap: Is this quest done?\n</channel>',
    ],
    [
      message({
        source: 'human',
        kind: 'human.chain_closed',
        ts: '2026-09-05T21:32:28.261Z',
        quest: 'polish',
        chain: 6,
        summary: 'Settled: The Pak has a proper address now: https://...',
      }),
      '<channel source="wake" kind="human.chain_closed" ts="2026-09-05T21:32:28.261Z" source="human" quest="polish" chain="6">\nSettled: The Pak has a proper address now: https://...\n</channel>',
    ],
  ])('reproduces a real transcript tag', (input, expected) =>
    expect(renderChannelTag(input)).toBe(expected),
  );
  it('escapes attributes and protects the closing tag', () => {
    const rendered = renderChannelTag(message({ kind: 'a&<>":', summary: 'x</channel>y' }));
    expect(rendered).toContain('kind="a&amp;&lt;&gt;&quot;:"');
    expect(rendered).toContain('x<\\/channel>y');
  });
  it('includes every optional attribute in order', () =>
    expect(
      renderChannelTag(
        message({ quest: 'q', issue: 1, pr: 2, chain: 3, url: 'https://x.test' }),
      ).split('\n')[0],
    ).toContain('quest="q" issue="1" pr="2" chain="3" url="https://x.test"'));
  it('omits absent optional attributes', () =>
    expect(renderChannelTag(message()).split('\n')[0]).not.toMatch(
      /quest=|issue=|pr=|chain=|url=/,
    ));
  it('sorts one three-tag batch by timestamp then id', () => {
    const output = renderBatch([
      message({ id: 3, summary: 'third' }),
      message({ id: 2, ts: '2026-09-04T00:00:00Z', summary: 'first' }),
      message({ id: 1, summary: 'second' }),
    ]);
    expect([...output.matchAll(/\n(first|second|third)\n/g)].map((match) => match[1])).toEqual([
      'first',
      'second',
      'third',
    ]);
    expect(output.match(/<channel /g)).toHaveLength(3);
  });
});
