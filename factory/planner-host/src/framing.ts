import type { QueuedMessage } from './queue.js';

const escapeAttribute = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export function renderChannelTag(message: QueuedMessage): string {
  const attrs: Array<[string, string | number | undefined]> = [
    ['kind', message.kind],
    ['ts', message.ts],
    ['source', message.source],
    ['quest', message.quest],
    ['issue', message.issue],
    ['pr', message.pr],
    ['chain', message.chain],
    ['url', message.url],
    ['run', message.run],
  ];
  const rendered = attrs
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => ` ${key}="${escapeAttribute(String(value))}"`)
    .join('');
  return `<channel source="wake"${rendered}>\n${message.summary.replaceAll('</channel>', '<\\/channel>')}\n</channel>`;
}

export function renderBatch(messages: QueuedMessage[]): string {
  return [...messages]
    .sort((a, b) => a.ts.localeCompare(b.ts) || a.id - b.id)
    .map(renderChannelTag)
    .join('\n');
}
