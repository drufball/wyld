import type { Individual } from '../creatures/individual.js';
import { autopilotHolds } from './authority.js';
import { choiceInputFrom, type Choice, type ChoiceInput } from './choice.js';
import type { CombatState } from './encounter.js';
import { shotHeld } from './hold.js';
import { canAfford } from './resolve.js';
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
const NOTICE_SECONDS = 1.5;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

const createRefusalFeedback = () => {
  let toasted = false;
  return {
    refused(entry: OrderEntry, name: string) {
      if (entry.kind !== 'move' || entry.heard || !entry.moveId)
        return { notice: null, toast: null };
      const notice = {
        id: entry.moveId,
        text: 'Too far — get closer' as const,
        refused: true as const,
        until: entry.at + NOTICE_SECONDS,
      };
      const toast = toasted ? null : `Too far — ${name} didn't hear you; get closer`;
      toasted = true;
      return { notice, toast };
    },
    reset(): void {
      toasted = false;
    },
  };
};

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
  autopilot: {
    armed(creatureId: string): string | null;
    fresh(creatureId: string): boolean;
    settle(creatureId: string): void;
  };
  chooser: { choose(input: ChoiceInput): Choice[] };
  authorityOf(creatureId: string): number;
  useMove(creatureId: string, moveId: string): boolean;
}): FiredMove[] => {
  if (input.combat.phase !== 'fight') return [];
  const fired: FiredMove[] = [];
  const held = (member: CombatState['party'][number], moveId: string): boolean => {
    const individual = input.party.find(({ id }) => id === member.id);
    const move = individual?.repertoire.find(({ id }) => id === moveId);
    if (!individual || !move) return false;
    return shotHeld({
      temperament: individual.temperament,
      needsLine: move.delivery === 'Bolt' || move.delivery === 'Arc',
      lastStanding: input.combat.party.every(({ id, downed }) => id === member.id || downed),
      distanceTiles: distance(member.tile, input.combat.enemy.tile),
      enemyReachTiles: input.combat.enemy.reachTiles,
    });
  };
  const commanded = (id: string): boolean => {
    const armed = input.autopilot.armed(id);
    return armed !== null && autopilotHolds(input.authorityOf(id));
  };
  const armedReady = (id: string): boolean => {
    const moveId = input.autopilot.armed(id);
    const member = input.combat.party.find(({ id: memberId }) => memberId === id);
    const individual = input.party.find(({ id: memberId }) => memberId === id);
    const move = individual?.repertoire.find(({ id: candidateId }) => candidateId === moveId);
    return (
      moveId !== null &&
      member !== undefined &&
      move !== undefined &&
      (member.cooldowns[moveId]?.remaining ?? 0) <= 0 &&
      canAfford(member.focus, move)
    );
  };
  for (const member of input.combat.party) {
    const moveId = input.autopilot.armed(member.id);
    if (
      moveId &&
      !member.downed &&
      !member.benched &&
      commanded(member.id) &&
      (!held(member, moveId) || input.autopilot.fresh(member.id))
    )
      if (input.useMove(member.id, moveId)) {
        input.autopilot.settle(member.id);
        fired.push({ creatureId: member.id, moveId, source: 'autopilot' });
      }
  }
  for (const choice of input.chooser.choose(
    choiceInputFrom(input.combat, input.party, (id) => commanded(id) && armedReady(id)),
  )) {
    const member = input.combat.party.find(({ id }) => id === choice.creatureId);
    if (member && !held(member, choice.moveId) && input.useMove(choice.creatureId, choice.moveId))
      fired.push({ ...choice, source: 'choice' });
  }
  return fired;
};

export { NOTICE_SECONDS, createOrderLog, createRefusalFeedback, fireOrders, ignoredTell };
export type { FiredMove, OrderEntry, OrderKind };
