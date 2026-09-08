import fs from 'node:fs/promises';
import path from 'node:path';

import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import {
  ArtifactSlug,
  Chain,
  ChainAnchor,
  ChainCapture,
  ChainKind,
  ChainStatus,
  Timestamp,
  type NewEvent,
} from '@wyld/shared';
import { z } from 'zod';

import type { AppDatabase } from './database.js';
import { ensureMechanicalBriefing } from './catchup.js';
import type { Config } from './config.js';
import { formatIssues } from './quests.js';
import { compareRumbles } from './rumbles.js';
import { artifacts, chainMessages, chains, demos, presence, quests } from './schema.js';

export const CHAIN_QUIET_SECONDS = 86_400;
export const CHAIN_LIMIT = 5;

const ChainCreate = z
  .object({
    text: z.string().min(1).max(2000),
    questId: z.string().min(1).optional(),
    author: z.enum(['human', 'planner']).default('human'),
    kind: ChainKind.exclude(['rumble', 'demo', 'action', 'unlock', 'briefing']).optional(),
    anchor: ChainAnchor.optional(),
    capture: ChainCapture.optional(),
    explainer: ArtifactSlug.optional(),
  })
  .strict();
const ChainQuery = z.object({
  quest: z.string().min(1).optional(),
  artifact: z.string().min(1).optional(),
  kind: z.string().optional(),
  status: z.union([ChainStatus, z.literal('all')]).default('open'),
  includeSnoozed: z.enum(['1', 'true']).optional(),
});
const ChainSnooze = z.object({ until: Timestamp }).strict();
const MessageCreate = z
  .object({ author: z.enum(['human', 'planner']), text: z.string().min(1).max(2000) })
  .strict();
const ChainClose = z
  .object({
    reason: z.enum(['settled', 'converted', 'done', 'read']).default('settled'),
    source: z.enum(['human', 'planner']).default('human'),
  })
  .strict();
const ChainReopen = z.object({ source: z.enum(['human', 'planner']).default('human') }).strict();

type Dependencies = {
  database: AppDatabase;
  now: () => Date;
  storeEvent: (event: NewEvent) => Promise<unknown>;
  config: Pick<Config, 'feedbackDir'>;
};

export function createChainRoutes({ database, now, storeEvent, config }: Dependencies) {
  const { db } = database;
  const app = new Hono();
  const notFound = (c: Context) => c.json({ error: 'Not Found' }, 404);
  const readChain = (id: number) => {
    const row = db.select().from(chains).where(eq(chains.id, id)).get();
    if (row === undefined) return undefined;
    const messages = db
      .select()
      .from(chainMessages)
      .where(eq(chainMessages.chainId, id))
      .orderBy(asc(chainMessages.id))
      .all();
    return Chain.parse({
      ...row,
      rumble:
        row.kind === 'rumble'
          ? {
              id: row.slug,
              title: row.title,
              context: row.context,
              options: row.options,
              chosen: row.chosen,
              chosenAt: row.chosenAt,
              blockingQuestIds: row.blockingQuestIds,
              kind: row.rumbleKind,
            }
          : null,
      messages,
    });
  };

  app.get('/chains', (c) => {
    const parsed = ChainQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    const requestedKinds: string[] =
      parsed.data.kind === undefined
        ? (['question', 'message'] as const)
        : parsed.data.kind === 'all'
          ? ChainKind.options
          : parsed.data.kind.split(',');
    const invalidKind = requestedKinds.find((kind) => !ChainKind.safeParse(kind).success);
    if (invalidKind !== undefined)
      return c.json(
        {
          error: 'Invalid request',
          issues: [
            { code: 'custom', path: ['kind'], message: `Unknown chain kind: ${invalidKind}` },
          ],
        },
        400,
      );
    if (requestedKinds.includes('briefing')) ensureMechanicalBriefing(database, now());
    if (
      parsed.data.quest !== undefined &&
      db.select().from(quests).where(eq(quests.id, parsed.data.quest)).get() === undefined
    )
      return notFound(c);
    if (
      parsed.data.artifact !== undefined &&
      db.select().from(artifacts).where(eq(artifacts.slug, parsed.data.artifact)).get() ===
        undefined
    )
      return notFound(c);
    const cutoff = new Date(now().getTime() - CHAIN_QUIET_SECONDS * 1000).toISOString();
    db.update(chains)
      .set({ status: 'settled' })
      .where(
        and(
          eq(chains.status, 'open'),
          inArray(chains.kind, ['question', 'message']),
          lt(chains.lastActivityAt, cutoff),
          or(isNull(chains.snoozedUntil), lt(chains.snoozedUntil, cutoff)),
        ),
      )
      .run();
    const visible =
      parsed.data.includeSnoozed === undefined
        ? or(isNull(chains.snoozedUntil), lt(chains.snoozedUntil, now().toISOString()))
        : undefined;
    const common = and(
      parsed.data.status === 'all' ? undefined : eq(chains.status, parsed.data.status),
      parsed.data.quest === undefined ? undefined : eq(chains.questId, parsed.data.quest),
      parsed.data.artifact === undefined
        ? undefined
        : sql`json_extract(${chains.anchor}, '$.artifact') = ${parsed.data.artifact}`,
      visible,
    );
    const conversationalKinds = requestedKinds.filter(
      (kind): kind is 'question' | 'message' => kind === 'question' || kind === 'message',
    );
    const cardKinds = requestedKinds.filter(
      (kind): kind is 'demo' | 'action' | 'unlock' | 'briefing' =>
        kind === 'demo' || kind === 'action' || kind === 'unlock' || kind === 'briefing',
    );
    const normalRows =
      conversationalKinds.length > 0
        ? db
            .select()
            .from(chains)
            .where(and(common, inArray(chains.kind, conversationalKinds)))
            .orderBy(desc(chains.lastActivityAt))
            .limit(CHAIN_LIMIT)
            .all()
        : [];
    const rumbleRows = requestedKinds.includes('rumble')
      ? db
          .select()
          .from(chains)
          .where(and(common, eq(chains.kind, 'rumble')))
          .all()
          .sort(compareRumbles)
      : [];
    const cardRows =
      cardKinds.length === 0
        ? []
        : db
            .select()
            .from(chains)
            .where(and(common, inArray(chains.kind, cardKinds)))
            .orderBy(desc(chains.lastActivityAt))
            .all();
    const rows = [...rumbleRows, ...normalRows, ...cardRows];
    if (rows.length === 0) return c.json([]);
    const messages = db
      .select()
      .from(chainMessages)
      .where(
        inArray(
          chainMessages.chainId,
          rows.map(({ id }) => id),
        ),
      )
      .orderBy(asc(chainMessages.id))
      .all();
    return c.json(
      rows.map((row) =>
        Chain.parse({
          ...row,
          rumble:
            row.kind === 'rumble'
              ? {
                  id: row.slug,
                  title: row.title,
                  context: row.context,
                  options: row.options,
                  chosen: row.chosen,
                  chosenAt: row.chosenAt,
                  blockingQuestIds: row.blockingQuestIds,
                  kind: row.rumbleKind,
                }
              : null,
          messages: messages.filter((message) => message.chainId === row.id),
        }),
      ),
    );
  });

  app.post('/chains', async (c) => {
    const parsed = ChainCreate.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    if (
      parsed.data.questId !== undefined &&
      db.select().from(quests).where(eq(quests.id, parsed.data.questId)).get() === undefined
    )
      return notFound(c);
    if (
      parsed.data.anchor !== undefined &&
      db.select().from(artifacts).where(eq(artifacts.slug, parsed.data.anchor.artifact)).get() ===
        undefined
    )
      return notFound(c);
    if (
      parsed.data.explainer !== undefined &&
      db.select().from(artifacts).where(eq(artifacts.slug, parsed.data.explainer)).get() ===
        undefined
    )
      return notFound(c);
    let image: { extension: 'jpg' | 'png'; bytes: Buffer } | undefined;
    if (parsed.data.capture?.screenshot !== null && parsed.data.capture?.screenshot !== undefined) {
      const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]*={0,2})$/.exec(
        parsed.data.capture.screenshot,
      );
      if (!match) return c.json({ error: 'Invalid screenshot' }, 400);
      const bytes = Buffer.from(match[2]!, 'base64');
      if (bytes.byteLength > 4 * 1024 * 1024)
        return c.json({ error: 'Screenshot exceeds 4 MB' }, 400);
      image = { extension: match[1] === 'jpeg' ? 'jpg' : 'png', bytes };
    }
    const ts = now().toISOString();
    const row = db
      .insert(chains)
      .values({
        kind: parsed.data.kind ?? (parsed.data.author === 'human' ? 'question' : 'message'),
        status: 'open',
        createdAt: ts,
        lastActivityAt: ts,
        questId: parsed.data.questId ?? null,
        tags:
          parsed.data.explainer === undefined
            ? [parsed.data.kind ?? (parsed.data.author === 'human' ? 'question' : 'message')]
            : ['look'],
        anchor: parsed.data.anchor ?? null,
        payload:
          parsed.data.capture === undefined && parsed.data.explainer === undefined ? null : {},
      })
      .returning({ id: chains.id })
      .get();
    if (parsed.data.capture !== undefined || parsed.data.explainer !== undefined) {
      let state = parsed.data.capture?.state ?? null;
      if (JSON.stringify(state)?.length > 65_536) state = null;
      const screenshot = image === undefined ? null : `/api/chains/${row.id}/screenshot`;
      const payload = {
        ...(parsed.data.capture === undefined ? {} : { capture: { screenshot, state, at: ts } }),
        ...(parsed.data.explainer === undefined ? {} : { explainer: parsed.data.explainer }),
      };
      if (image) {
        await fs.mkdir(config.feedbackDir, { recursive: true });
        await fs.writeFile(
          path.join(config.feedbackDir, `chain-${row.id}.${image.extension}`),
          image.bytes,
        );
      }
      db.update(chains).set({ payload }).where(eq(chains.id, row.id)).run();
    }
    db.insert(chainMessages)
      .values({ chainId: row.id, author: parsed.data.author, text: parsed.data.text, ts })
      .run();
    await storeEvent({
      source: parsed.data.author,
      kind: parsed.data.author === 'human' ? 'human.question' : 'planner.chain_updated',
      ...(parsed.data.questId === undefined ? {} : { questId: parsed.data.questId }),
      payload: {
        chainId: row.id,
        text: parsed.data.text,
        ...(parsed.data.questId === undefined ? {} : { questId: parsed.data.questId }),
      },
    });
    return c.json(readChain(row.id)!, 201);
  });

  app.get('/chains/:id/screenshot', async (c) => {
    const id = z.coerce.number().int().positive().safeParse(c.req.param('id'));
    if (!id.success) return c.json(formatIssues(id.error), 400);
    const row = db.select().from(chains).where(eq(chains.id, id.data)).get();
    const screenshot =
      row?.payload?.capture && typeof row.payload.capture === 'object'
        ? (row.payload.capture as { screenshot?: unknown }).screenshot
        : null;
    if (typeof screenshot !== 'string') return notFound(c);
    const extension =
      screenshot.endsWith('/screenshot') &&
      (await fs
        .access(path.join(config.feedbackDir, `chain-${id.data}.jpg`))
        .then(() => 'jpg')
        .catch(() => 'png'));
    try {
      const bytes = await fs.readFile(
        path.join(config.feedbackDir, `chain-${id.data}.${extension}`),
      );
      return new Response(bytes, {
        headers: { 'content-type': extension === 'png' ? 'image/png' : 'image/jpeg' },
      });
    } catch {
      return notFound(c);
    }
  });

  app.post('/chains/:id/messages', async (c) => {
    const id = Number(c.req.param('id'));
    const current = Number.isInteger(id) ? readChain(id) : undefined;
    if (current === undefined || current.status !== 'open') return notFound(c);
    const parsed = MessageCreate.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    const ts = now().toISOString();
    db.insert(chainMessages)
      .values({ chainId: id, ...parsed.data, ts })
      .run();
    db.update(chains).set({ lastActivityAt: ts }).where(eq(chains.id, id)).run();
    await storeEvent({
      source: parsed.data.author,
      kind: parsed.data.author === 'human' ? 'human.question' : 'planner.chain_updated',
      ...(current.questId === null ? {} : { questId: current.questId }),
      payload: {
        chainId: id,
        text: parsed.data.text,
        ...(current.questId === null ? {} : { questId: current.questId }),
      },
    });
    return c.json(readChain(id)!, 201);
  });

  app.post('/chains/:id/close', async (c) => {
    const id = Number(c.req.param('id'));
    const current = Number.isInteger(id) ? readChain(id) : undefined;
    if (current === undefined) return notFound(c);
    const parsed = ChainClose.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    if (parsed.data.reason === 'done' && (current.kind !== 'demo' || current.questId === null))
      return c.json(
        {
          error: 'Invalid request',
          issues: [
            {
              code: 'custom',
              path: ['reason'],
              message: 'done requires a demo chain with a quest',
            },
          ],
        },
        400,
      );
    if (parsed.data.reason === 'read' && current.kind !== 'briefing')
      return c.json(
        {
          error: 'Invalid request',
          issues: [
            {
              code: 'custom',
              path: ['reason'],
              message: 'read requires a briefing chain',
            },
          ],
        },
        400,
      );
    if (parsed.data.reason === 'done') {
      const quest = db.select().from(quests).where(eq(quests.id, current.questId!)).get()!;
      db.update(quests).set({ status: 'done' }).where(eq(quests.id, quest.id)).run();
      await storeEvent({
        source: 'planner',
        kind: 'planner.quest_updated',
        questId: quest.id,
        payload: { summary: `Quest "${quest.title}" is now done`, status: 'done' },
      });
    }
    if (current.kind === 'demo' && current.demoId !== null)
      db.update(demos)
        .set({ hiddenAt: now().toISOString() })
        .where(and(eq(demos.id, current.demoId), isNull(demos.hiddenAt)))
        .run();
    if (current.kind === 'briefing') {
      const toEventId = current.payload?.['toEventId'];
      if (typeof toEventId === 'number')
        db.update(presence).set({ lastCatchupEventId: toEventId }).where(eq(presence.id, 1)).run();
    }
    const status =
      parsed.data.reason === 'done' || parsed.data.reason === 'read'
        ? 'settled'
        : parsed.data.reason;
    db.update(chains).set({ status }).where(eq(chains.id, id)).run();
    const firstText = current.messages[0]?.text ?? '';
    const text =
      `${parsed.data.reason === 'settled' ? 'Settled' : parsed.data.reason === 'done' ? 'Done' : parsed.data.reason === 'read' ? 'Read' : 'Made a quest of'}: ${firstText}`.slice(
        0,
        160,
      );
    await storeEvent({
      source: parsed.data.source,
      kind: parsed.data.source === 'human' ? 'human.chain_closed' : 'planner.chain_updated',
      ...(current.questId === null ? {} : { questId: current.questId }),
      payload:
        parsed.data.source === 'human'
          ? {
              chainId: id,
              reason: parsed.data.reason,
              text,
              ...(current.questId === null ? {} : { questId: current.questId }),
            }
          : {
              chainId: id,
              text,
              ...(current.questId === null ? {} : { questId: current.questId }),
            },
    });
    return c.json(readChain(id)!);
  });

  app.post('/chains/:id/reopen', async (c) => {
    const id = Number(c.req.param('id'));
    const current = Number.isInteger(id) ? readChain(id) : undefined;
    if (current === undefined) return notFound(c);
    const parsed = ChainReopen.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    if (current.kind === 'rumble')
      return c.json(
        {
          error: 'Invalid request',
          issues: [{ code: 'custom', path: ['id'], message: 'rumbles use the rumble route' }],
        },
        400,
      );
    if (current.status === 'open') return c.json(current);
    const ts = now().toISOString();
    db.update(chains).set({ status: 'open', lastActivityAt: ts }).where(eq(chains.id, id)).run();
    if (current.kind === 'demo' && current.demoId !== null) {
      db.update(demos).set({ hiddenAt: null }).where(eq(demos.id, current.demoId)).run();
      if (current.questId !== null) {
        const quest = db.select().from(quests).where(eq(quests.id, current.questId)).get();
        if (quest?.status === 'done') {
          db.update(quests).set({ status: 'demo' }).where(eq(quests.id, quest.id)).run();
          await storeEvent({
            source: 'planner',
            kind: 'planner.quest_updated',
            questId: quest.id,
            payload: { summary: `Quest "${quest.title}" is now demo`, status: 'demo' },
          });
        }
      }
    }
    const text = `Reopened: ${current.messages[0]?.text ?? ''}`.slice(0, 160);
    await storeEvent({
      source: 'planner',
      kind: 'planner.chain_updated',
      ...(current.questId === null ? {} : { questId: current.questId }),
      payload: {
        chainId: id,
        text,
        ...(current.questId === null ? {} : { questId: current.questId }),
      },
    });
    return c.json(readChain(id)!);
  });

  app.post('/chains/:id/snooze', async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || readChain(id) === undefined) return notFound(c);
    const parsed = ChainSnooze.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success || new Date(parsed.data.until).getTime() <= now().getTime())
      return c.json(
        parsed.success
          ? {
              error: 'Invalid request',
              issues: [{ code: 'custom', path: ['until'], message: 'until must be in the future' }],
            }
          : formatIssues(parsed.error),
        400,
      );
    db.update(chains).set({ snoozedUntil: parsed.data.until }).where(eq(chains.id, id)).run();
    return c.json(readChain(id)!);
  });

  app.post('/chains/:id/unsnooze', (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || readChain(id) === undefined) return notFound(c);
    db.update(chains).set({ snoozedUntil: null }).where(eq(chains.id, id)).run();
    return c.json(readChain(id)!);
  });

  return app;
}
