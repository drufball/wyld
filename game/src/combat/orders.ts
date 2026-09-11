import type { Individual } from '../creatures/individual.js';
import { autopilotHolds } from './authority.js';
import { choiceInputFrom, type Choice, type ChoiceInput } from './choice.js';
import type { CombatState } from './encounter.js';
import type { CombatTell } from './tells.js';

type OrderKind = 'walk' | 'move';
type OrderEntry = {
  creatureId: string;
  kind: OrderKind;
  moveId: string | null;
  distanceTiles: number;
  authority: number;
  heard: boolean;
  at: number;
};
type FiredMove = { creatureId: string; moveId: string; source: 'autopilot' | 'choice' };

const ignoredTell = (entry: OrderEntry): CombatTell | null =>
  entry.heard ? null : { kind: 'ignored', text: '…', targetId: entry.creatureId };

const createOrderLog = (limit = 50) => {
  let entries: OrderEntry[] = [];
  return {
    record(entry: OrderEntry): void {
      entries.push({ ...entry });
      if (entries.length > limit) entries.splice(0, entries.length - limit);
    },
    list: (): readonly OrderEntry[] => entries.map((entry) => ({ ...entry })),
    clear: (): void => {
      entries = [];
    },
  };
};

const fireOrders = (input: {
  combat: CombatState;
  party: readonly Individual[];
  autopilot: { armed(creatureId: string): string | null };
  chooser: { choose(input: ChoiceInput): Choice[] };
  authorityOf(creatureId: string): number;
  useMove(creatureId: string, moveId: string): boolean;
}): FiredMove[] => {
  if (input.combat.phase !== 'fight') return [];
  const fired: FiredMove[] = [];
  const commanded = (id: string): boolean => {
    const armed = input.autopilot.armed(id);
    return armed !== null && autopilotHolds(input.authorityOf(id));
  };
  for (const member of input.combat.party) {
    const moveId = input.autopilot.armed(member.id);
    if (moveId && !member.downed && !member.benched && commanded(member.id))
      if (input.useMove(member.id, moveId))
        fired.push({ creatureId: member.id, moveId, source: 'autopilot' });
  }
  for (const choice of input.chooser.choose(choiceInputFrom(input.combat, input.party, commanded)))
    if (input.useMove(choice.creatureId, choice.moveId))
      fired.push({ ...choice, source: 'choice' });
  return fired;
};

export { createOrderLog, fireOrders, ignoredTell };
export type { FiredMove, OrderEntry, OrderKind };
