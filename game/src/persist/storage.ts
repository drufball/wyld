import type { StorageLike } from '../arena/persistence.js';

const PROBE_KEY = '__wyld_probe__';

const memoryStorage = (): Storage => {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(String(key)) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(String(key)),
    setItem: (key, value) => void values.set(String(key), String(value)),
  };
};

const safeStorage = (): StorageLike & Storage => {
  try {
    const storage = globalThis.localStorage;
    if (storage != null) {
      storage.setItem(PROBE_KEY, '1');
      storage.removeItem(PROBE_KEY);
      return storage;
    }
  } catch {
    // Sandboxed and storage-disabled browsers can throw on either access or writes.
  }

  return memoryStorage();
};

export { safeStorage };
