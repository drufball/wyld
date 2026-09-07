import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Event, type NewEvent } from '@wyld/shared';

import { createAchievements } from './achievements.js';
import { openDatabase, type AppDatabase } from './database.js';

const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');

describe('achievements', () => {
  let directory: string;
  let database: AppDatabase;
  let eventId: number;
  let storeEvent: ReturnType<typeof vi.fn<(value: NewEvent) => Promise<Event>>>;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyld-achievements-'));
    database = openDatabase(path.join(directory, 'pak.sqlite'), migrations);
    eventId = 0;
    storeEvent = vi.fn(async (value) =>
      Event.parse({ ...value, id: ++eventId, ts: '2026-09-06T09:00:00.000Z' }),
    );
  });
  afterEach(() => {
    database.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  function service() {
    const result = createAchievements({
      database,
      now: () => new Date('2026-09-06T09:00:00.000Z'),
      storeEvent,
      timeZone: 'Europe/London',
    });
    result.seed();
    return result;
  }
  function world() {
    database.sqlite.prepare("INSERT INTO worlds VALUES ('w', 'World', 'game', 1, 'x')").run();
  }
  function quest(id: string, status: string) {
    database.sqlite
      .prepare('INSERT INTO quests (id, world_id, title, pitch, status) VALUES (?, ?, ?, ?, ?)')
      .run(id, 'w', id, id, status);
  }
  async function verify(id: string, arrange: () => void) {
    const achievements = service();
    expect((await achievements.evaluate()).map((item) => item.id)).not.toContain(id);
    arrange();
    expect((await achievements.evaluate()).map((item) => item.id)).toContain(id);
    const calls = storeEvent.mock.calls.length;
    expect(await achievements.evaluate()).toEqual([]);
    expect(storeEvent).toHaveBeenCalledTimes(calls);
  }

  it('unlocks first quest completion', async () => {
    world();
    quest('one', 'building');
    await verify('first-quest-done', () =>
      database.sqlite.prepare("UPDATE quests SET status = 'done'").run(),
    );
    expect(
      database.sqlite
        .prepare("SELECT kind, status, tags, payload FROM chains WHERE kind = 'unlock'")
        .get(),
    ).toMatchObject({
      kind: 'unlock',
      status: 'open',
      tags: JSON.stringify(['unlock']),
      payload: expect.stringContaining('first-quest-done'),
    });
    expect(storeEvent).toHaveBeenCalledTimes(2);
  });
  it('announces a created unlock chain with its first message', async () => {
    world();
    quest('one', 'done');
    await service().evaluate();
    const chain = database.sqlite
      .prepare(
        "SELECT chains.id, chain_messages.text FROM chains JOIN chain_messages ON chain_messages.chain_id = chains.id WHERE chains.kind = 'unlock'",
      )
      .get() as { id: number; text: string };
    expect(storeEvent).toHaveBeenCalledWith({
      source: 'planner',
      kind: 'planner.chain_updated',
      payload: { chainId: chain.id, text: chain.text },
    });
    expect(chain.text).toBe('Achievement unlocked — First Light');
  });
  it('unlocks five completions at five, not four', async () => {
    world();
    for (let index = 1; index <= 4; index += 1) quest(String(index), 'done');
    await verify('five-done', () => quest('five', 'done'));
  });
  it('unlocks first feedback', async () => {
    await verify('first-feedback', () =>
      database.sqlite
        .prepare("INSERT INTO feedback (demo_id, text, created) VALUES ('d', 'note', '2026-09-06')")
        .run(),
    );
  });
  it('unlocks only a clean night', async () => {
    database.sqlite
      .prepare(
        "INSERT INTO sleep_runs (started, trigger, outcome) VALUES ('2026-09-06', 'human', 'timed_out')",
      )
      .run();
    await verify('first-night', () =>
      database.sqlite.prepare("UPDATE sleep_runs SET outcome = 'clean'").run(),
    );
  });
  it('unlocks a decided rumble', async () => {
    database.sqlite
      .prepare(
        "INSERT INTO chains (kind, status, created_at, last_activity_at) VALUES ('rumble', 'open', '2026', '2026')",
      )
      .run();
    await verify('first-rumble', () =>
      database.sqlite.prepare("UPDATE chains SET chosen = 'A'").run(),
    );
  });
  it('checks only the latest seen event in the configured timezone', async () => {
    database.sqlite
      .prepare(
        "INSERT INTO events (ts, source, kind, payload) VALUES ('2026-09-06T07:30:00Z', 'human', 'human.seen', '{}')",
      )
      .run();
    await verify('early-bird', () =>
      database.sqlite
        .prepare(
          "INSERT INTO events (ts, source, kind, payload) VALUES ('2026-09-06T05:30:00Z', 'human', 'human.seen', '{}')",
        )
        .run(),
    );
  });
  it('unlocks at three consecutive retro dates, not two', async () => {
    const add = (date: string) =>
      database.sqlite
        .prepare(
          "INSERT INTO retros (date, summary, wins, misses, factory_improvements, stats, generated_by, created_at, updated_at) VALUES (?, 's', '[]', '[]', '[]', '{}', 'planner', '2026', '2026')",
        )
        .run(date);
    add('2026-09-06');
    add('2026-09-05');
    await verify('streak-3', () => add('2026-09-04'));
  });
});
