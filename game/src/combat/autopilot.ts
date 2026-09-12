const DOUBLE_TAP_SECONDS = 0.35;

type ArmedMove = { creatureId: string; moveId: string };
type Tap = { moveId: string; at: number; previous: string | null };

const createAutopilot = () => {
  const armedMoves = new Map<string, string>();
  const lastTaps = new Map<string, Tap>();
  const freshMoves = new Set<string>();

  return {
    doubleTapPending(creatureId: string, moveId: string, now: number): boolean {
      const last = lastTaps.get(creatureId);
      return last?.moveId === moveId && now - last.at <= DOUBLE_TAP_SECONDS;
    },
    tap(creatureId: string, moveId: string, now: number): void {
      const last = lastTaps.get(creatureId);
      if (last?.moveId === moveId && now - last.at <= DOUBLE_TAP_SECONDS) {
        if (last.previous === null) armedMoves.delete(creatureId);
        else armedMoves.set(creatureId, last.previous);
        freshMoves.delete(creatureId);
        lastTaps.delete(creatureId);
        return;
      }

      const previous = armedMoves.get(creatureId) ?? null;
      lastTaps.set(creatureId, { moveId, at: now, previous });
      if (previous === moveId) {
        armedMoves.delete(creatureId);
        freshMoves.delete(creatureId);
      } else {
        armedMoves.set(creatureId, moveId);
        freshMoves.add(creatureId);
      }
    },
    armed(creatureId: string): string | null {
      return armedMoves.get(creatureId) ?? null;
    },
    fresh(creatureId: string): boolean {
      return freshMoves.has(creatureId);
    },
    settle(creatureId: string): void {
      freshMoves.delete(creatureId);
    },
    clear(creatureId: string): void {
      armedMoves.delete(creatureId);
      lastTaps.delete(creatureId);
      freshMoves.delete(creatureId);
    },
    clearAll(): void {
      armedMoves.clear();
      lastTaps.clear();
      freshMoves.clear();
    },
    list(): readonly ArmedMove[] {
      return [...armedMoves].map(([creatureId, moveId]) => ({ creatureId, moveId }));
    },
  };
};

export { createAutopilot, DOUBLE_TAP_SECONDS };
