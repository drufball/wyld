import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDemoBuilder, type CommandRunner } from './builder.js';

describe('demo builder', () => {
  let root: string | undefined;
  afterEach(async () => root && fs.rm(root, { recursive: true, force: true }));

  const setup = async (runner?: CommandRunner) => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'wyld-builder-'));
    const worktreesDir = path.join(root, 'worktrees');
    const run: CommandRunner =
      runner ??
      (async (command, args, options) => {
        if (command === 'pnpm' && args.includes('build')) {
          await fs.mkdir(path.join(options.cwd!, 'game/dist'), { recursive: true });
          await fs.writeFile(path.join(options.cwd!, 'game/dist/index.html'), 'game');
        }
        return {};
      });
    return {
      builder: createDemoBuilder({
        repoDir: '/repo',
        demosDir: path.join(root, 'demos'),
        worktreesDir,
        logger: () => undefined,
        run,
      }),
      run,
    };
  };

  it('runs the build sequence and publishes atomically', async () => {
    const { builder, run } = await setup();
    const spy = vi.spyOn({ run }, 'run');
    // Use a forwarding builder so calls are observable without invoking real commands.
    const observed = createDemoBuilder({
      repoDir: '/repo',
      demosDir: path.join(root!, 'demos'),
      worktreesDir: path.join(root!, 'worktrees'),
      logger: () => undefined,
      run: (...args) => spy(...args),
    });
    await expect(observed.build('main', 'main')).resolves.toEqual({ ok: true });
    expect(spy.mock.calls.map(([command, args]) => `${command} ${args.join(' ')}`)).toEqual(
      expect.arrayContaining([
        'git -C /repo fetch origin main',
        'pnpm install --frozen-lockfile --prefer-offline',
        'pnpm --filter @wyld/game build',
      ]),
    );
    await expect(fs.readFile(path.join(root!, 'demos/main/index.html'), 'utf8')).resolves.toBe(
      'game',
    );
    expect(builder.isBuilding('main')).toBe(false);
  });

  it('rejects bad slugs, shares an in-flight promise, and resolves failures', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const run = vi.fn<CommandRunner>(async (_command, args) => {
      if (args.includes('fetch')) await gate;
      throw Object.assign(new Error('nope'), { stderr: 'network unavailable' });
    });
    const { builder } = await setup(run);
    await expect(builder.build('../bad', 'main')).resolves.toEqual({
      ok: false,
      error: 'Invalid demo slug',
    });
    const first = builder.build('main', 'main');
    const second = builder.build('main', 'other');
    expect(first).toBe(second);
    release();
    await expect(first).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('fetch failed: network unavailable'),
    });
    expect(run).toHaveBeenCalledTimes(2); // fetch plus best-effort cleanup
  });
});
