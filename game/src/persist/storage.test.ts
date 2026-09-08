// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { safeStorage } from './storage.js';

const originalStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
const replaceStorage = (value: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined) =>
  Object.defineProperty(window, 'localStorage', { configurable: true, value });
const denyStorageAccess = () =>
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException(
        "The document is sandboxed and lacks the 'allow-same-origin' flag.",
        'SecurityError',
      );
    },
  });

afterEach(() => {
  if (originalStorageDescriptor) {
    Object.defineProperty(window, 'localStorage', originalStorageDescriptor);
    window.localStorage.clear();
  }
});

describe('safe storage', () => {
  it('returns the real localStorage when it is readable and writable', () => {
    expect(safeStorage()).toBe(window.localStorage);
  });

  it('falls back to in-memory storage when reading localStorage throws a SecurityError', () => {
    denyStorageAccess();
    expect(() => safeStorage()).not.toThrow();
  });

  it('falls back to in-memory storage when localStorage is undefined', () => {
    replaceStorage(undefined);
    expect(() => safeStorage()).not.toThrow();
    const storage = safeStorage();
    storage.setItem('answer', '42');
    expect(storage.getItem('answer')).toBe('42');
  });

  it('falls back to in-memory storage when setItem throws', () => {
    const blocked = {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new DOMException('Storage is disabled', 'QuotaExceededError');
      },
    };
    replaceStorage(blocked);
    expect(safeStorage()).not.toBe(blocked);
  });

  it('round-trips values through the in-memory fallback', () => {
    denyStorageAccess();
    const storage = safeStorage();
    expect(storage.getItem('missing')).toBeNull();
    storage.setItem('answer', '42');
    expect(storage.getItem('answer')).toBe('42');
    storage.removeItem('answer');
    expect(storage.getItem('answer')).toBeNull();
  });

  it('supports length, key and clear on the in-memory fallback', () => {
    denyStorageAccess();
    const storage = safeStorage();
    storage.setItem('first', '1');
    storage.setItem('second', '2');
    expect(storage.length).toBe(2);
    expect(storage.key(0)).toBe('first');
    expect(storage.key(1)).toBe('second');
    expect(storage.key(2)).toBeNull();
    storage.clear();
    expect(storage.length).toBe(0);
  });

  it('leaves no probe key behind in real storage', () => {
    safeStorage();
    expect(window.localStorage.getItem('__wyld_probe__')).toBeNull();
  });

  it('has no direct localStorage access outside the storage accessor', () => {
    const testFileUrl = new URL(import.meta.url);
    const src = fileURLToPath(new URL('../', testFileUrl));
    const allowed = new Set(['persist/storage.ts']);
    const files = readdirSync(src, { recursive: true, withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'),
      )
      .map((entry) => path.relative(src, path.join(entry.parentPath, entry.name)));
    const offenders = files.filter(
      (file) =>
        !allowed.has(file) && readFileSync(`${src}/${file}`, 'utf8').includes('localStorage'),
    );
    expect(offenders, `Direct localStorage access found in: ${offenders.join(', ')}`).toEqual([]);
  });
});
