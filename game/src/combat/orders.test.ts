import { describe, expect, it, vi } from 'vitest';
import { createOrderLog, fireOrders, ignoredTell, type OrderEntry } from './orders.js';

const entry = (heard: boolean, at = 0): OrderEntry => ({
  creatureId: 'fighter',
  kind: 'walk',
  moveId: null,
  distanceTiles: 9,
  authority: 0,
  heard,
  at,
});
describe('orders', () => {
  it('raises the "…" tell only on an order that was not heard', () => {
    expect(ignoredTell(entry(true))).toBeNull();
    expect(ignoredTell(entry(false))).toEqual({ kind: 'ignored', text: '…', targetId: 'fighter' });
  });
  it('keeps the most recent fifty orders, oldest first', () => {
    const log = createOrderLog();
    for (let at = 0; at < 55; at++) log.record(entry(true, at));
    expect(log.list().map((o) => o.at)).toEqual(Array.from({ length: 50 }, (_, i) => i + 5));
  });
  it('yields an armed move to the chooser below half authority and resumes above it', () => {
    const combat = {
      phase: 'fight',
      elapsed: 0,
      enemy: { tile: { x: 0, y: 0 }, downed: false },
      party: [
        {
          id: 'fighter',
          tile: { x: 0, y: 0 },
          focus: 10,
          downed: false,
          benched: false,
          windup: null,
          cooldowns: {},
        },
      ],
    } as never;
    const useMove = vi.fn(() => true),
      chooser = { choose: vi.fn(() => [] as { creatureId: string; moveId: string }[]) };
    const input = {
      combat,
      party: [{ id: 'fighter', temperament: 'Bold', repertoire: [] }] as never,
      autopilot: { armed: () => 'light' },
      chooser,
      useMove,
    };
    expect(fireOrders({ ...input, authorityOf: () => 1 })[0]?.source).toBe('autopilot');
    chooser.choose.mockReturnValue([{ creatureId: 'fighter', moveId: 'heavy' }]);
    expect(fireOrders({ ...input, authorityOf: () => 1 / 6 })[0]?.source).toBe('choice');
    expect(fireOrders({ ...input, authorityOf: () => 1 })[0]?.moveId).toBe('light');
  });
  it('never fires or chooses outside a fight', () => {
    const choose = vi.fn(() => []),
      useMove = vi.fn(() => true);
    expect(
      fireOrders({
        combat: { phase: 'win' } as never,
        party: [{ id: 'fighter', temperament: 'Bold', repertoire: [] }] as never,
        autopilot: { armed: () => null },
        chooser: { choose },
        authorityOf: () => 1,
        useMove,
      }),
    ).toEqual([]);
    expect(choose).not.toHaveBeenCalled();
    expect(useMove).not.toHaveBeenCalled();
  });
});
