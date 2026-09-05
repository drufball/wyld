import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createToolRegistry, type ToolRegistry } from './channel.js';
import { createToolReloader } from './reload.js';

const watcher = new EventEmitter() as EventEmitter & { close: ReturnType<typeof vi.fn> };
watcher.close = vi.fn();
vi.mock('node:fs', () => ({
  watch: vi.fn((_path, _options, listener) => {
    watcher.on('change', listener);
    return watcher;
  }),
}));

function registryWith(name: string): ToolRegistry {
  const registry = createToolRegistry({ pakUrl: 'http://pak', fetch: vi.fn() });
  return { ...registry, tools: [{ ...registry.tools[0]!, name }] } as ToolRegistry;
}

describe('tool reloader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    watcher.removeAllListeners();
  });

  it('installs, announces, and logs a fresh registry', async () => {
    const next = registryWith('pak_new_tool');
    const swap = vi.fn();
    const notify = vi.fn(async () => undefined);
    const log = vi.fn();
    const importModule = vi.fn(async () => ({ createToolRegistry: () => next }));
    const reloader = createToolReloader({
      moduleUrl: 'file:///channel.js',
      registerOptions: { pakUrl: 'http://pak' },
      swap,
      notify,
      log,
      importModule,
    });

    await expect(reloader.reload('test')).resolves.toBe(true);
    expect(importModule).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/channel\.js\?reload=\d+$/),
    );
    expect(swap).toHaveBeenCalledWith(next);
    expect(notify).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith(
      'info',
      'wake channel reloaded its tools',
      expect.objectContaining({ added: ['pak_new_tool'] }),
    );
  });

  it.each([
    [
      'an import failure',
      async () => {
        throw new Error('broken build');
      },
    ],
    ['a missing factory', async () => ({ other: true })],
  ])('keeps the current registry for %s', async (_label, importModule) => {
    const swap = vi.fn();
    const notify = vi.fn();
    const log = vi.fn();
    const reloader = createToolReloader({
      moduleUrl: 'file:///channel.js',
      registerOptions: { pakUrl: 'http://pak' },
      swap,
      notify,
      log,
      importModule,
    });
    await expect(reloader.reload('test')).resolves.toBe(false);
    expect(swap).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      'error',
      expect.any(String),
      expect.objectContaining({ reason: 'test' }),
    );
  });

  it('keeps the new registry when notification fails', async () => {
    const next = registryWith('pak_new_tool');
    const swap = vi.fn();
    const log = vi.fn();
    const reloader = createToolReloader({
      moduleUrl: 'file:///channel.js',
      registerOptions: { pakUrl: 'http://pak' },
      swap,
      notify: async () => {
        throw new Error('client gone');
      },
      log,
      importModule: async () => ({ createToolRegistry: () => next }),
    });
    await expect(reloader.reload('test')).resolves.toBe(false);
    expect(swap).toHaveBeenCalledWith(next);
    expect(log).toHaveBeenCalledWith(
      'error',
      expect.any(String),
      expect.objectContaining({ error: 'client gone' }),
    );
  });

  it('debounces a burst of watch events into one reload', async () => {
    vi.useFakeTimers();
    const importModule = vi.fn(async () => ({
      createToolRegistry: () => registryWith('pak_new_tool'),
    }));
    const reloader = createToolReloader({
      moduleUrl: 'file:///channel.js',
      registerOptions: { pakUrl: 'http://pak' },
      swap: vi.fn(),
      notify: vi.fn(async () => undefined),
      log: vi.fn(),
      importModule,
      debounceMs: 10,
    });
    reloader.watch('/dist');
    watcher.emit('change');
    watcher.emit('change');
    watcher.emit('change');
    await vi.advanceTimersByTimeAsync(10);
    expect(importModule).toHaveBeenCalledOnce();
    reloader.stop();
    vi.useRealTimers();
  });
});
