import type { CombatEvent } from '../combat/encounter.js';
import { RESISTANCE_MULTIPLIER, WEAKNESS_MULTIPLIER } from '../combat/hides.js';
import type { Force, Move } from '../combat/moves.js';
import type { HideType, Temperament } from '../creatures/species.js';
import type { Notebook } from '../guide/notebook.js';

type LearnedFact =
  | { kind: 'hide'; value: HideType }
  | { kind: 'weakness'; value: Force }
  | { kind: 'resistance'; value: Force }
  | { kind: 'move'; value: string }
  | { kind: 'temperament'; value: Temperament };

type LearningOptions = {
  notebook: Notebook;
  events: readonly CombatEvent[];
  enemySpeciesId: string;
  enemyId: string;
  moves: readonly Move[];
  ownedIds: readonly string[];
  hide: HideType;
  temperament: Temperament;
  fightEnded?: boolean;
  fightsFought?: number;
};

const learnFromCombat = (options: LearningOptions): LearnedFact[] => {
  const learned: LearnedFact[] = [];
  if (
    options.notebook.page(options.enemySpeciesId) === null &&
    options.events.some(
      (event) =>
        (event.type === 'hit' && event.target === options.enemyId) ||
        (event.type === 'executed' && event.attacker === options.enemyId) ||
        (options.fightEnded && (event.type === 'win' || event.type === 'driven-off')),
    )
  )
    options.notebook.identify(options.enemySpeciesId, {
      region: null,
      phase: 'Day',
      position: { x: 0, y: 0, z: 0 },
      day: 0,
    });
  const add = (recorded: boolean, fact: LearnedFact): void => {
    if (recorded) learned.push(fact);
  };
  for (const event of options.events) {
    if (
      event.type === 'hit' &&
      event.target === options.enemyId &&
      event.attacker !== undefined &&
      options.ownedIds.includes(event.attacker)
    ) {
      add(options.notebook.recordHide(options.enemySpeciesId, options.hide), {
        kind: 'hide',
        value: options.hide,
      });
      const force = options.moves.find((move) => move.id === event.move)?.force;
      if (force && event.hideMult === WEAKNESS_MULTIPLIER)
        add(options.notebook.recordWeakness(options.enemySpeciesId, force), {
          kind: 'weakness',
          value: force,
        });
      if (force && event.hideMult === RESISTANCE_MULTIPLIER)
        add(options.notebook.recordResistance(options.enemySpeciesId, force), {
          kind: 'resistance',
          value: force,
        });
    }
    if (event.type === 'executed' && event.attacker === options.enemyId) {
      const move = options.moves.find((candidate) => candidate.id === event.move);
      if (move)
        add(options.notebook.recordMove(options.enemySpeciesId, move.name), {
          kind: 'move',
          value: move.name,
        });
    }
  }
  if (options.fightEnded && (options.fightsFought ?? 0) === 0)
    add(options.notebook.recordTemperament(options.enemySpeciesId, options.temperament), {
      kind: 'temperament',
      value: options.temperament,
    });
  return learned;
};

const learnedFactText = (fact: LearnedFact): string => {
  if (fact.kind === 'hide') return `Hide: ${fact.value}`;
  if (fact.kind === 'weakness') return `Takes heavy damage from ${fact.value}`;
  if (fact.kind === 'resistance') return `Shrugs off ${fact.value}`;
  if (fact.kind === 'move') return `Uses ${fact.value}`;
  return `Temperament: ${fact.value}`;
};

export { learnFromCombat, learnedFactText };
export type { LearnedFact, LearningOptions };
