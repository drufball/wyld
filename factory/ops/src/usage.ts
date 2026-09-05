import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

export async function readTokensToday(directory: string, now: Date): Promise<number | undefined> {
  let files: string[];
  try { files = await readdir(directory); } catch { return undefined; }
  const day = now.toISOString().slice(0, 10);
  let total = 0;
  for (const file of files) {
    const stream = createReadStream(path.join(directory, file), { encoding: 'utf8' });
    stream.on('error', () => undefined);
    const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
    try {
      for await (const line of lines) {
        try {
          const entry = JSON.parse(line) as { type?: string; timestamp?: string; message?: { model?: string; usage?: Record<string, unknown> } };
          if (entry.type !== 'assistant' || entry.message?.model === '<synthetic>' || entry.timestamp?.slice(0, 10) !== day) continue;
          const usage = entry.message?.usage;
          if (!usage) continue;
          for (const key of ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']) {
            const value = usage[key];
            if (typeof value === 'number' && Number.isFinite(value)) total += value;
          }
        } catch { /* A damaged line must not hide other measurements. */ }
      }
    } catch { /* An unreadable individual file is skipped. */ }
  }
  return total;
}
