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
        'git -C /repo fetch origin -- main',
        'pnpm install --frozen-lockfile --prefer-offline',
        'pnpm --filter @wyld/game... build',
      ]),
    );
    await expect(fs.readFile(path.join(root!, 'demos/main/index.html'), 'utf8')).resolves.toBe(
      'game',
    );
    expect(builder.isBuilding('main')).toBe(false);
  });

  it('builds and publishes a Pak with its branch base', async () => {
    const calls: Parameters<CommandRunner>[] = [];
    const { builder } = await setup(async (...args) => {
      calls.push(args);
      const [command, commandArgs, options] = args;
      if (command === 'pnpm' && commandArgs.includes('build')) {
        const dist = path.join(options.cwd!, 'factory/pak/dist');
        await fs.mkdir(dist, { recursive: true });
        await fs.writeFile(path.join(dist, 'index.html'), 'pak');
      }
      return {};
    });

    await expect(builder.build('branch', 'feature/ref', 'pak')).resolves.toEqual({ ok: true });
    const build = calls.find(([command, args]) => command === 'pnpm' && args.includes('build'))!;
    expect(build[1]).toEqual(['--filter', '@wyld/pak...', 'build']);
    expect(build[2].env?.PAK_BASE).toBe('/play/branch/');
    await expect(fs.readFile(path.join(root!, 'demos/branch/index.html'), 'utf8')).resolves.toBe(
      'pak',
    );
  });

  it('varies only the filter, base variable, and published source between targets', async () => {
    const calls: Parameters<CommandRunner>[] = [];
    const { builder } = await setup(async (...args) => {
      calls.push(args);
      const [command, commandArgs, options] = args;
      if (command === 'pnpm' && commandArgs.includes('build')) {
        const source = commandArgs.includes('@wyld/game...') ? 'game/dist' : 'factory/pak/dist';
        await fs.mkdir(path.join(options.cwd!, source), { recursive: true });
        await fs.writeFile(path.join(options.cwd!, source, 'index.html'), source);
      }
      return {};
    });
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

    await expect(builder.build('comparison', 'feature/ref', 'game')).resolves.toEqual({ ok: true });
    const gameCalls = calls.splice(0);
    await expect(
      fs.readFile(path.join(root!, 'demos/comparison/index.html'), 'utf8'),
    ).resolves.toBe('game/dist');
    await expect(builder.build('comparison', 'feature/ref', 'pak')).resolves.toEqual({ ok: true });
    const pakCalls = calls.splice(0);
    now.mockRestore();

    const gameBuild = gameCalls.find(
      ([command, args]) => command === 'pnpm' && args.includes('build'),
    )!;
    const pakBuild = pakCalls.find(
      ([command, args]) => command === 'pnpm' && args.includes('build'),
    )!;
    expect(gameBuild[1]).toEqual(['--filter', '@wyld/game...', 'build']);
    expect(pakBuild[1]).toEqual(['--filter', '@wyld/pak...', 'build']);
    expect(gameBuild[2].env?.GAME_BASE).toBe('/play/comparison/');
    expect(gameBuild[2].env?.PAK_BASE).toBeUndefined();
    expect(pakBuild[2].env?.PAK_BASE).toBe('/play/comparison/');
    expect(pakBuild[2].env?.GAME_BASE).toBeUndefined();

    const normalize = (sequence: Parameters<CommandRunner>[]) =>
      sequence.map(([command, args, options]) => {
        const { GAME_BASE: gameBase, PAK_BASE: pakBase, ...environment } = options.env ?? {};
        return {
          command,
          args: args.map((argument) =>
            argument === '@wyld/game...' || argument === '@wyld/pak...' ? '<target>' : argument,
          ),
          options: {
            ...options,
            ...(options.env === undefined
              ? {}
              : { env: { ...environment, BASE: gameBase ?? pakBase } }),
          },
        };
      });
    expect(normalize(pakCalls)).toEqual(normalize(gameCalls));
    await expect(
      fs.readFile(path.join(root!, 'demos/comparison/index.html'), 'utf8'),
    ).resolves.toBe('factory/pak/dist');
  });

  it('builds workspace dependencies before the target', async () => {
    for (const target of ['game', 'pak'] as const) {
      const calls: Parameters<CommandRunner>[] = [];
      const slug = `dependencies-${target}`;
      let publishedIndex = '';
      const { builder } = await setup(async (...args) => {
        calls.push(args);
        const [command, commandArgs, options] = args;
        if (command === 'pnpm' && commandArgs.includes('build')) {
          await expect(fs.stat(publishedIndex)).rejects.toThrow();
          const source = target === 'game' ? 'game/dist' : 'factory/pak/dist';
          await fs.mkdir(path.join(options.cwd!, source), { recursive: true });
          await fs.writeFile(path.join(options.cwd!, source, 'index.html'), target);
        }
        return {};
      });
      publishedIndex = path.join(root!, 'demos', slug, 'index.html');

      await expect(builder.build(slug, 'main', target)).resolves.toEqual({ ok: true });

      const sequence = calls.filter(
        ([command, args]) =>
          (command === 'git' && args.includes('add')) ||
          (command === 'pnpm' && (args.includes('install') || args.includes('build'))),
      );
      expect(sequence.map(([command, args]) => [command, ...args])).toEqual([
        [
          'git',
          '-C',
          '/repo',
          'worktree',
          'add',
          '--detach',
          path.join(root!, 'worktrees', slug),
          'FETCH_HEAD',
        ],
        ['pnpm', 'install', '--frozen-lockfile', '--prefer-offline'],
        ['pnpm', '--filter', `@wyld/${target}...`, 'build'],
      ]);
      const buildFilter = sequence[2]?.[1][1];
      expect(buildFilter).toMatch(/\.\.\.$/);
      await expect(fs.readFile(publishedIndex, 'utf8')).resolves.toBe(target);
    }
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
