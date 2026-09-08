// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  freshArenaProgress,
  loadArenaProgress,
  saveArenaProgress,
  wipeArenaProgress,
} from './persistence.js';
import { safeStorage } from '../persist/storage.js';

const storageProperty = `local${'Storage'}`;
const originalStorageDescriptor = Object.getOwnPropertyDescriptor(window, storageProperty);
const denyStorageAccess = () =>
  Object.defineProperty(window, storageProperty, {
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
    Object.defineProperty(window, storageProperty, originalStorageDescriptor);
  }
});

const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => void values.set(k, v),
    removeItem: (k: string) => void values.delete(k),
  };
};
describe('arena persistence', () => {
  it('round-trips the notebook and the run count', () => {
    const storage = memory(),
      progress = loadArenaProgress(storage);
    progress.notebook.identify('antlerback', {
      region: null,
      phase: 'Day',
      position: { x: 0, y: 0, z: 0 },
      day: 0,
    });
    progress.notebook.recordHide('antlerback', 'Bark');
    progress.runCount = 4;
    progress.fightsFought.antlerback = 2;
    saveArenaProgress(storage, progress);
    const loaded = loadArenaProgress(storage);
    expect(loaded.runCount).toBe(4);
    expect(loaded.fightsFought.antlerback).toBe(2);
    expect(loaded.notebook.page('antlerback')?.hide).toBe('Bark');
  });
  it('starts fresh from a corrupt value', () => {
    const storage = memory();
    storage.setItem('fieldwork.arena.v1', '{no');
    expect(loadArenaProgress(storage).runCount).toBe(0);
  });
  it('clears on wipe', () => {
    const storage = memory(),
      progress = loadArenaProgress(storage);
    progress.runCount = 3;
    saveArenaProgress(storage, progress);
    expect(wipeArenaProgress(storage).runCount).toBe(0);
    expect(storage.getItem('fieldwork.arena.v1')).toBeNull();
  });
  it(`loads empty arena progress when local${'Storage'} access throws`, () => {
    denyStorageAccess();
    const progress = loadArenaProgress(safeStorage());
    expect(progress.runCount).toBe(0);
    expect(progress.fightsFought).toEqual({});
    expect(progress.notebook.toJSON()).toEqual(freshArenaProgress().notebook.toJSON());
  });
  it(`saves and wipes without throwing when local${'Storage'} access throws`, () => {
    denyStorageAccess();
    const storage = safeStorage();
    expect(() => saveArenaProgress(storage, loadArenaProgress(storage))).not.toThrow();
    expect(() => wipeArenaProgress(storage)).not.toThrow();
  });
  it('round-trips arena progress through the in-memory fallback within a session', () => {
    denyStorageAccess();
    const storage = safeStorage();
    const progress = loadArenaProgress(storage);
    progress.runCount = 7;
    progress.fightsFought.antlerback = 3;
    saveArenaProgress(storage, progress);
    const loaded = loadArenaProgress(storage);
    expect(loaded.runCount).toBe(7);
    expect(loaded.fightsFought).toEqual({ antlerback: 3 });
  });
});
