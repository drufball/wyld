import { describe, expect, it } from 'vitest';
import type { CombatEvent } from '../combat/encounter.js';
import { hideMultiplier, resistance, weakness } from '../combat/hides.js';
import type { Force, Move } from '../combat/moves.js';
import { createEmptyNotebook } from '../guide/notebook.js';
import { learnFromCombat } from './learning.js';

const heat: Move = {
  id: 'emberjack:flare',
  name: 'Flare',
  delivery: 'Bolt',
  force: 'Heat',
  power: 1,
  speed: 1,
  cooldownMult: 1,
  rangeMult: 1,
  modifiers: [],
  familiarity: 0,
  upgradeLevel: 0,
};
const cut: Move = { ...heat, id: 'thornwren:cut', name: 'Cut', force: 'Cut' };
const rush: Move = { ...heat, id: 'antlerback:bull-rush', name: 'Bull Rush', force: 'Impact' };
const surge: Move = { ...heat, id: 'rillfin:surge', name: 'Surge', force: 'Surge' };
const moves = [heat, cut, rush, surge];
const run = (events: CombatEvent[], notebook = createEmptyNotebook(), extra = {}) => ({
  notebook,
  facts: learnFromCombat({
    notebook,
    events,
    enemySpeciesId: 'antlerback',
    enemyId: 'antlerback',
    moves,
    ownedIds: ['emberjack', 'thornwren'],
    hide: 'Bark',
    temperament: 'Bold',
    ...extra,
  }),
});

describe('arena learning', () => {
  it('records a weakness and a resistance straight off the hide table', () => {
    const hides = ['Bark', 'Shell', 'Scale', 'Hide', 'Stone'] as const;
    const forces: Force[] = ['Impact', 'Cut', 'Heat', 'Surge'];
    const moveFor = (force: Force): Move => moves.find((move) => move.force === force)!;
    for (const hide of hides) {
      const weakForce = weakness(hide);
      const weakMove = moveFor(weakForce);
      expect(
        run(
          [
            {
              type: 'hit',
              attacker: 'emberjack',
              target: 'antlerback',
              move: weakMove.id,
              hideMult: hideMultiplier(hide, weakForce),
            },
          ],
          createEmptyNotebook(),
          { hide },
        ).notebook.page('antlerback')?.weakness,
      ).toBe(weakForce);

      const resistedForce = resistance(hide);
      const resistedMove = moveFor(resistedForce);
      expect(
        run(
          [
            {
              type: 'hit',
              attacker: 'emberjack',
              target: 'antlerback',
              move: resistedMove.id,
              hideMult: hideMultiplier(hide, resistedForce),
            },
          ],
          createEmptyNotebook(),
          { hide },
        ).notebook.page('antlerback')?.resistance,
      ).toBe(resistedForce);

      const neutralForce = forces.find((force) => force !== weakForce && force !== resistedForce);
      expect(neutralForce).toBeDefined();
      const neutralMove = moveFor(neutralForce!);
      const page = run(
        [
          {
            type: 'hit',
            attacker: 'emberjack',
            target: 'antlerback',
            move: neutralMove.id,
            hideMult: hideMultiplier(hide, neutralForce!),
          },
        ],
        createEmptyNotebook(),
        { hide },
      ).notebook.page('antlerback');
      expect(page?.weakness).toBeNull();
      expect(page?.resistance).toBeNull();
    }
  });

  it('records the hide on the first landed hit', () =>
    expect(
      run([
        { type: 'hit', attacker: 'emberjack', target: 'antlerback', move: heat.id, hideMult: 1 },
      ]).notebook.page('antlerback')?.hide,
    ).toBe('Bark'));
  it('records a weakness only on a 1.6 hit', () =>
    expect(
      run([
        { type: 'hit', attacker: 'emberjack', target: 'antlerback', move: heat.id, hideMult: 1.6 },
      ]).notebook.page('antlerback')?.weakness,
    ).toBe('Heat'));
  it('records a resistance only on a 0.6 hit', () =>
    expect(
      run([
        { type: 'hit', attacker: 'thornwren', target: 'antlerback', move: cut.id, hideMult: 0.6 },
      ]).notebook.page('antlerback')?.resistance,
    ).toBe('Cut'));
  it('records the shrugged-off force on the tick the resisted hit lands', () => {
    const result = run(
      [{ type: 'hit', attacker: 'thornwren', target: 'antlerback', move: cut.id, hideMult: 0.6 }],
      createEmptyNotebook(),
      { fightEnded: false },
    );
    expect(result.facts).toContainEqual({ kind: 'resistance', value: 'Cut' });
    expect(result.notebook.page('antlerback')?.resistance).toBe('Cut');
  });
  it('records nothing extra on a neutral hit', () =>
    expect(
      run([
        { type: 'hit', attacker: 'emberjack', target: 'antlerback', move: heat.id, hideMult: 1 },
      ]).facts,
    ).toEqual([{ kind: 'hide', value: 'Bark' }]));
  it('records every enemy move it saw executed', () =>
    expect(
      run([{ type: 'executed', attacker: 'antlerback', move: rush.id }]).notebook.page('antlerback')
        ?.moves,
    ).toEqual(['Bull Rush']));
  it('records the temperament after the first fight', () =>
    expect(
      run([{ type: 'driven-off' }], createEmptyNotebook(), {
        fightEnded: true,
        fightsFought: 0,
      }).notebook.page('antlerback')?.temperaments,
    ).toEqual(['Bold']));
  it('returns only what was newly learned', () => {
    const n = createEmptyNotebook();
    n.recordHide('antlerback', 'Bark');
    expect(
      run(
        [
          {
            type: 'hit',
            attacker: 'emberjack',
            target: 'antlerback',
            move: heat.id,
            hideMult: 1.6,
          },
        ],
        n,
      ).facts,
    ).toEqual([{ kind: 'weakness', value: 'Heat' }]);
  });
  it('learns nothing twice', () => {
    const n = createEmptyNotebook();
    const events: CombatEvent[] = [{ type: 'executed', attacker: 'antlerback', move: rush.id }];
    run(events, n);
    expect(run(events, n).facts).toEqual([]);
  });
});
