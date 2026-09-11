import { WakeMessageWire, type WakeMessageWire as WakeMessageWireType } from '@wyld/shared';
import { z } from 'zod';
import type { Logger } from '@wyld/shared';

export type QueuedMessage = WakeMessageWireType & { id: number };

export function createQueueClient(options: {
  wakeUrl: string;
  wakeSecret: string;
  log: Logger;
  fetch?: typeof fetch;
}) {
  const request = options.fetch ?? fetch;
  let loggedUnauthorized = false;
  const post = async (path: string, body: unknown): Promise<Response> => {
    const response = await request(`${options.wakeUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Wake-Secret': options.wakeSecret,
      },
      body: JSON.stringify(body),
    });
    if (response.status === 401 && !loggedUnauthorized) {
      loggedUnauthorized = true;
      options.log('error', 'Wake daemon rejected planner host authentication', {
        path,
        status: 401,
      });
    }
    if (!response.ok)
      throw new Error(`${path} returned HTTP ${response.status}: ${await response.text()}`);
    return response;
  };
  return {
    async claim(limit: number): Promise<{ messages: QueuedMessage[]; dropped: number[] }> {
      const value: unknown = await (await post('/queue/claim', { limit })).json();
      const envelope = z.object({ messages: z.array(z.unknown()) }).parse(value);
      const schema = WakeMessageWire.extend({ id: z.number().int().positive() });
      const messages: QueuedMessage[] = [];
      const dropped: number[] = [];
      for (const entry of envelope.messages) {
        const parsed = schema.safeParse(entry);
        if (parsed.success) {
          messages.push(parsed.data);
          continue;
        }
        const id =
          typeof entry === 'object' &&
          entry !== null &&
          'id' in entry &&
          Number.isInteger(entry.id) &&
          Number(entry.id) > 0
            ? Number(entry.id)
            : undefined;
        const context = { error: parsed.error.message, ...(id === undefined ? {} : { id }) };
        if (id === undefined)
          options.log(
            'error',
            'Wake queue abandoned an unparseable message without a usable id',
            context,
          );
        else {
          options.log('warn', 'Wake queue dropped an unparseable message', context);
          dropped.push(id);
        }
      }
      return { messages, dropped };
    },
    async ack(ids: number[]): Promise<void> {
      if (ids.length > 0) await post('/queue/ack', { ids });
    },
  };
}
export type QueueClient = ReturnType<typeof createQueueClient>;
