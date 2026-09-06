import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import type { LogContext } from './logger.js';

const execFileAsync = promisify(execFile);
export const DEMO_SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

export type CommandRunner = (
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; timeout: number },
) => Promise<{ stdout?: string; stderr?: string }>;

type Result = { ok: true } | { ok: false; error: string };
type Dependencies = {
  repoDir: string;
  demosDir: string;
  worktreesDir: string;
  logger: (level: 'info' | 'error', message: string, context?: LogContext) => void;
  run?: CommandRunner;
};

const realRun: CommandRunner = async (command, args, options) =>
  execFileAsync(command, args, { ...options, encoding: 'utf8' });

const failureText = (error: unknown) => {
  const value = error as { stderr?: unknown; stdout?: unknown; message?: unknown };
  return `${String(value.stderr ?? '')}\n${String(value.stdout ?? '')}\n${String(value.message ?? error)}`
    .trim()
    .slice(-800);
};

export function createDemoBuilder(dependencies: Dependencies) {
  const run = dependencies.run ?? realRun;
  const inFlight = new Map<string, Promise<Result>>();

  const buildOnce = async (slug: string, ref: string, target: 'game' | 'pak'): Promise<Result> => {
    if (!DEMO_SLUG.test(slug)) return { ok: false, error: 'Invalid demo slug' };
    const worktree = path.join(dependencies.worktreesDir, slug);
    const temporary = path.join(dependencies.demosDir, `${slug}.tmp`);
    const published = path.join(dependencies.demosDir, slug);
    const deadline = Date.now() + 15 * 60 * 1000;
    let step = 'prepare';
    const command = async (
      executable: string,
      args: string[],
      cwd?: string,
      env?: NodeJS.ProcessEnv,
    ) => {
      const timeout = deadline - Date.now();
      if (timeout <= 0) throw new Error('Build timed out');
      return run(executable, args, {
        ...(cwd === undefined ? {} : { cwd }),
        ...(env === undefined ? {} : { env }),
        timeout,
      });
    };
    try {
      await fs.mkdir(dependencies.worktreesDir, { recursive: true });
      await fs.mkdir(dependencies.demosDir, { recursive: true });
      step = 'fetch';
      await command('git', ['-C', dependencies.repoDir, 'fetch', 'origin', '--', ref]);
      step = 'remove stale worktree';
      await command('git', [
        '-C',
        dependencies.repoDir,
        'worktree',
        'remove',
        '--force',
        worktree,
      ]).catch(() => undefined);
      await fs.rm(worktree, { recursive: true, force: true });
      await command('git', ['-C', dependencies.repoDir, 'worktree', 'prune']);
      step = 'create worktree';
      await command('git', [
        '-C',
        dependencies.repoDir,
        'worktree',
        'add',
        '--detach',
        worktree,
        'FETCH_HEAD',
      ]);
      step = 'install dependencies';
      await command('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], worktree);
      step = `build ${target}`;
      const packageName = target === 'game' ? '@wyld/game' : '@wyld/pak';
      const baseVariable = target === 'game' ? 'GAME_BASE' : 'PAK_BASE';
      await command('pnpm', ['--filter', packageName, 'build'], worktree, {
        ...process.env,
        [baseVariable]: `/play/${slug}/`,
      });
      step = 'publish build';
      await fs.rm(temporary, { recursive: true, force: true });
      const source =
        target === 'game'
          ? path.join(worktree, 'game/dist')
          : path.join(worktree, 'factory/pak/dist');
      await fs.cp(source, temporary, { recursive: true });
      await fs.rm(published, { recursive: true, force: true });
      await fs.rename(temporary, published);
      dependencies.logger('info', 'demo build completed', { slug, ref });
      return { ok: true };
    } catch (error) {
      const summary = `${step} failed: ${failureText(error)}`;
      dependencies.logger('error', 'demo build failed', { slug, ref, error: summary });
      await fs.rm(temporary, { recursive: true, force: true }).catch(() => undefined);
      return { ok: false, error: summary };
    } finally {
      await command('git', [
        '-C',
        dependencies.repoDir,
        'worktree',
        'remove',
        '--force',
        worktree,
      ]).catch(() => undefined);
      await fs.rm(worktree, { recursive: true, force: true }).catch(() => undefined);
    }
  };

  return {
    build(slug: string, ref: string, target: 'game' | 'pak' = 'game'): Promise<Result> {
      const current = inFlight.get(slug);
      if (current !== undefined) return current;
      const promise = buildOnce(slug, ref, target).finally(() => inFlight.delete(slug));
      inFlight.set(slug, promise);
      return promise;
    },
    isBuilding: (slug: string) => inFlight.has(slug),
  };
}

export type DemoBuilder = ReturnType<typeof createDemoBuilder>;
