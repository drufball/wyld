import {
  createNotebook,
  notebookFromJSON,
  type Notebook,
  type NotebookJSON,
} from '../guide/notebook.js';

const ARENA_STORAGE_KEY = 'fieldwork.arena.v1';
type ArenaProgress = { notebook: Notebook; runCount: number; fightsFought: Record<string, number> };
type ArenaProgressJSON = {
  notebook: NotebookJSON;
  runCount: number;
  fightsFought: Record<string, number>;
};
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const freshArenaProgress = (): ArenaProgress => ({
  notebook: createNotebook(),
  runCount: 0,
  fightsFought: {},
});
const validCounts = (value: unknown): value is Record<string, number> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((count) => Number.isInteger(count) && count >= 0);

const loadArenaProgress = (storage: StorageLike): ArenaProgress => {
  try {
    const raw = storage.getItem(ARENA_STORAGE_KEY);
    if (raw === null) return freshArenaProgress();
    const parsed = JSON.parse(raw) as Partial<ArenaProgressJSON>;
    if (
      !Number.isInteger(parsed.runCount) ||
      parsed.runCount! < 0 ||
      !validCounts(parsed.fightsFought)
    )
      return freshArenaProgress();
    return {
      notebook: notebookFromJSON(parsed.notebook),
      runCount: parsed.runCount!,
      fightsFought: { ...parsed.fightsFought },
    };
  } catch {
    return freshArenaProgress();
  }
};
const saveArenaProgress = (storage: StorageLike, progress: ArenaProgress): void => {
  const value: ArenaProgressJSON = {
    notebook: progress.notebook.toJSON(),
    runCount: progress.runCount,
    fightsFought: { ...progress.fightsFought },
  };
  storage.setItem(ARENA_STORAGE_KEY, JSON.stringify(value));
};
const wipeArenaProgress = (storage: StorageLike): ArenaProgress => {
  storage.removeItem(ARENA_STORAGE_KEY);
  return freshArenaProgress();
};

export {
  ARENA_STORAGE_KEY,
  freshArenaProgress,
  loadArenaProgress,
  saveArenaProgress,
  wipeArenaProgress,
};
export type { ArenaProgress, ArenaProgressJSON, StorageLike };
