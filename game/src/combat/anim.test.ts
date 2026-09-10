import { describe, expect, it } from 'vitest';
import { buildArenaIndividual, enemy, rosterMember } from '../arena/roster.js';
import { canAfford, damage } from './resolve.js';
import { arenaSpeedTilesPerSecond } from './pace.js';
import type { CombatEvent } from './encounter.js';
import { createEncounter } from './encounter.js';
import { LUNGE_OUT_FRACTION, LUNGE_PEAK_TILES, LUNGE_SECONDS, createAnimations } from './anim.js';

const executed = (attacker = 'a', target = 'b', move = 'strike'): CombatEvent => ({
  type: 'executed',
  attacker,
  target,
  move,
});
const tiles = new Map([
  ['a', { x: 0, y: 0 }],
  ['b', { x: 3, y: 4 }],
]);
const tileOf = (id: string) => tiles.get(id);

describe('combat animation', () => {
  it('starts one lunge for each executed move', () => {
    const subject = createAnimations();
    subject.push([executed(), executed('b', 'a', 'bolt')], tileOf);
    expect(subject.list()).toHaveLength(2);
    expect(subject.startedCount()).toBe(2);
  });

  it('starts no lunge for a hit, a miss or a downed event', () => {
    const subject = createAnimations();
    subject.push(
      [
        { type: 'hit', attacker: 'a', target: 'b', move: 'strike' },
        { type: 'miss', attacker: 'a', target: 'b', move: 'bolt' },
        { type: 'downed', target: 'b' },
      ],
      tileOf,
    );
    expect(subject.list()).toHaveLength(0);
    expect(subject.startedCount()).toBe(0);
  });

  it('points the lunge at the target and freezes that direction', () => {
    const subject = createAnimations();
    subject.push([executed()], tileOf);
    expect(subject.list()[0]!.direction).toEqual({ x: 0.6, y: 0.8 });
    tiles.set('b', { x: -3, y: 0 });
    expect(subject.list()[0]!.direction).toEqual({ x: 0.6, y: 0.8 });
    tiles.set('b', { x: 3, y: 4 });
  });

  it('peaks at four hundredths of a second in and snaps back to zero', () => {
    expect(LUNGE_SECONDS).toBe(0.25);
    expect(LUNGE_PEAK_TILES).toBe(0.45);
    const subject = createAnimations();
    subject.push([executed()], tileOf);
    expect(subject.offsetFor('a')).toEqual({ x: 0, y: 0 });
    subject.update(LUNGE_SECONDS * LUNGE_OUT_FRACTION);
    expect(subject.offsetFor('a').x).toBeCloseTo(0.27);
    expect(subject.offsetFor('a').y).toBeCloseTo(0.36);
    subject.update(LUNGE_SECONDS * (1 - LUNGE_OUT_FRACTION));
    expect(subject.offsetFor('a')).toEqual({ x: 0, y: 0 });
  });

  it('finishes a lunge after two hundred and fifty milliseconds', () => {
    const subject = createAnimations();
    subject.push([executed()], tileOf);
    subject.update(LUNGE_SECONDS + Number.EPSILON);
    expect(subject.list()).toHaveLength(0);
  });

  it('replaces a lunge when the same attacker executes again', () => {
    const subject = createAnimations();
    subject.push([executed()], tileOf);
    subject.update(0.05);
    subject.push([executed('a', 'b', 'bolt')], tileOf);
    expect(subject.list()).toHaveLength(1);
    expect(subject.list()[0]).toMatchObject({ moveId: 'bolt', elapsed: 0 });
    expect(subject.startedCount()).toBe(2);
  });

  it('records a lunge with no direction when attacker and target share a tile', () => {
    const subject = createAnimations();
    subject.push([executed()], () => ({ x: 1, y: 1 }));
    expect(subject.list()[0]!.direction).toEqual({ x: 0, y: 0 });
    expect(subject.startedCount()).toBe(1);
  });

  it('clears every lunge when the fight ends', () => {
    const subject = createAnimations();
    subject.push([executed(), executed('b', 'a')], tileOf);
    subject.clear();
    expect(subject.list()).toHaveLength(0);
  });

  it('produces exactly one lunge for every executed move of a full fight', () => {
    const party = ['loamox', 'bramblehog', 'thornwren'].map((id) =>
        buildArenaIndividual(rosterMember(id)!),
      ),
      foe = buildArenaIndividual(enemy('antlerback')!),
      positions = Object.fromEntries(
        party.map((individual, index) => [individual.id, { x: index + 4, y: 8 }]),
      ),
      encounter = createEncounter({
        party,
        enemy: foe,
        grid: { isWalkable: () => true },
        rng: { next: () => 0 },
        partyTiles: positions,
        enemyTile: { x: 5, y: 2 },
        reserve: '',
      }),
      subject = createAnimations(),
      dt = 1 / 60;
    let executedCount = 0;
    while (encounter.state().phase === 'fight' && encounter.state().elapsed < 90) {
      const state = encounter.state();
      for (const individual of party) {
        const combatant = state.party.find(({ id }) => id === individual.id)!;
        if (!combatant.downed) {
          const best = individual.repertoire
            .filter(
              (move) =>
                combatant.cooldowns[move.id]!.remaining <= 0 && canAfford(combatant.focus, move),
            )
            .sort(
              (a, b) =>
                damage(b, individual.stats.power, 'Bark') -
                damage(a, individual.stats.power, 'Bark'),
            )[0];
          if (best) encounter.useMove(individual.id, best.id, foe.id);
          const current = positions[individual.id]!,
            dx = state.enemy.tile.x - current.x,
            dy = state.enemy.tile.y - current.y,
            distance = Math.hypot(dx, dy),
            step = Math.min(arenaSpeedTilesPerSecond(individual.stats.speed) * dt, distance);
          current.x += (dx / (distance || 1)) * step;
          current.y += (dy / (distance || 1)) * step;
        }
      }
      const events = encounter.update(dt, positions);
      const next = encounter.state();
      for (const combatant of next.party) positions[combatant.id] = { ...combatant.tile };
      const tileAt = (id: string) =>
        next.party.find((combatant) => combatant.id === id)?.tile ??
        (id === foe.id ? next.enemy.tile : undefined);
      subject.push(events, tileAt);
      subject.update(dt);
      executedCount += events.filter(({ type }) => type === 'executed').length;
    }
    // This deterministic 60 Hz fight executes 13 moves.
    expect(executedCount).toBe(13);
    expect(subject.startedCount()).toBe(executedCount);
  });
});
