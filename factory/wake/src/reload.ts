import { watch as watchDirectory, type FSWatcher } from 'node:fs';

import { createToolRegistry, type Logger, type ToolRegistry } from './channel.js';

export function createToolReloader(options: {
  moduleUrl: string;
  registerOptions: { pakUrl: string };
  swap: (next: ToolRegistry) => void;
  notify: () => Promise<void>;
  log: Logger;
  importModule?: (specifier: string) => Promise<unknown>;
  debounceMs?: number;
}): {
  reload(reason: string): Promise<boolean>;
  watch(directory: string): void;
  stop(): void;
} {
  const importModule = options.importModule ?? ((specifier: string) => import(specifier));
  const debounceMs = options.debounceMs ?? 750;
  let current = createToolRegistry(options.registerOptions);
  let watcher: FSWatcher | undefined;
  let timer: NodeJS.Timeout | undefined;

  const reload = async (reason: string): Promise<boolean> => {
    try {
      // A unique query defeats Node's ESM module cache, loading the newly built channel module.
      const fresh = await importModule(`${options.moduleUrl}?reload=${Date.now()}`);
      const factory = (fresh as { createToolRegistry?: unknown }).createToolRegistry;
      if (typeof factory !== 'function')
        throw new Error('module does not export createToolRegistry');
      const next = (factory as (value: { pakUrl: string }) => ToolRegistry)(
        options.registerOptions,
      );
      const previousNames = new Set(current.tools.map(({ name }) => name));
      const nextNames = new Set(next.tools.map(({ name }) => name));
      const added = [...nextNames].filter((name) => !previousNames.has(name));
      const removed = [...previousNames].filter((name) => !nextNames.has(name));
      options.swap(next);
      current = next;
      await options.notify();
      options.log('info', 'wake channel reloaded its tools', {
        reason,
        toolCount: next.tools.length,
        added,
        removed,
      });
      return true;
    } catch (error) {
      options.log('error', 'wake channel tool reload failed', {
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  };

  return {
    reload,
    watch(directory) {
      try {
        watcher?.close();
        watcher = watchDirectory(directory, { persistent: false }, () => {
          if (timer !== undefined) clearTimeout(timer);
          timer = setTimeout(() => void reload('dist changed'), debounceMs);
        });
      } catch (error) {
        options.log('warn', 'wake channel could not watch for tool changes', {
          directory,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    stop() {
      watcher?.close();
      watcher = undefined;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
  };
}

// Reloading channel.js does not evict @wyld/shared from Node's cache. This refreshes tools added
// or removed in channel.ts, but schema-only changes inside @wyld/shared still require a restart.
