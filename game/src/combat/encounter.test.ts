import { describe, expect, it } from 'vitest';
import { buildArenaIndividual, enemy, rosterMember } from '../arena/roster.js';
import type { Individual } from '../creatures/individual.js';
import { FACING_YAW } from '../creatures/facing.js';
import type { Move } from './moves.js';
import { createEncounter, type EncounterOptions, type Point } from './encounter.js';
import { deliveries } from './resolve.js';

const member = (id: string): Individual => buildArenaIndividual(rosterMember(id)!);
const antlerback = (): Individual => buildArenaIndividual(enemy('antlerback')!);
const openGrid = { isWalkable: () => true };
const fixed = { next: () => 0 };
const move = (delivery: Move['delivery'], force: Move['force'] = 'Impact'): Move => ({
  id: delivery.toLowerCase(),
  name: delivery,
  delivery,
  force,
  power: 2,
  speed: 1,
  cooldownMult: 1,
  rangeMult: 1,
  modifiers: [],
  familiarity: 0,
  upgradeLevel: 0,
});
const fighter = (id: string, moves: Move[], overrides: Partial<Individual> = {}): Individual => ({
  ...member('loamox'),
  id,
  repertoire: moves,
  ...overrides,
});
const setup = (options: Partial<EncounterOptions> = {}) =>
  createEncounter({
    party: [fighter('owned', [move('Strike')])],
    enemy: fighter('enemy', [move('Strike')], {
      stats: { vigor: 70, power: 3, speed: 4, focus: 0 },
    }),
    grid: openGrid,
    rng: fixed,
    partyTiles: { owned: { x: 0, y: 0 } },
    enemyTile: { x: 5, y: 0 },
    player: { x: 0, y: 0 },
    ...options,
  });
const advance = (
  encounter: ReturnType<typeof setup>,
  seconds: number,
  positions = {},
  player?: Point,
) => {
  const events = [];
  for (let time = 0; time < seconds; time += 0.05)
    events.push(...encounter.update(0.05, positions, player));
  return events;
};

describe('combat encounter', () => {
  it('faces a combatant toward a target to the east with the shared yaw convention', () => {
    const subject = setup({
      partyTiles: { owned: { x: 5, y: 0 } },
      enemyTile: { x: 0, y: 0 },
    });
    subject.update(0.05);
    expect(subject.state().enemy.facing).toBeCloseTo(FACING_YAW.right);
  });

  it('picks the move whose range best matches the distance', () => {
    const subject = setup({
      enemy: fighter('enemy', [move('Strike'), move('Bolt')]),
      enemyTile: { x: 8, y: 0 },
    });
    expect(subject.chooseEnemyMove()).toBe('bolt');
  });

  it('misses a Bolt when the target has moved out of the line', () => {
    const bolt = move('Bolt');
    const subject = setup({
      party: [fighter('owned', [bolt])],
      enemy: fighter('enemy', [move('Strike')], { temperament: 'Erratic' }),
      enemyTile: { x: 8, y: 0 },
    });
    expect(subject.useMove('owned', bolt.id)).toBe(true);
    const events = advance(subject, 2);
    expect(events.some((event) => event.type === 'miss' && event.move === bolt.id)).toBe(true);
  });

  it('hits a Bolt that reaches a target that stayed put', () => {
    const bolt = move('Bolt');
    const subject = setup({ party: [fighter('owned', [bolt])], enemyTile: { x: 4, y: 0 } });
    subject.useMove('owned', bolt.id);
    expect(
      advance(subject, 2).some((event) => event.type === 'hit' && event.move === bolt.id),
    ).toBe(true);
  });

  it('lands an Arc where the target was at launch', () => {
    const arc = move('Arc');
    const subject = setup({ party: [fighter('owned', [arc])], enemyTile: { x: 4, y: 0 } });
    subject.useMove('owned', arc.id);
    advance(subject, 0.8);
    expect(advance(subject, 1).some((event) => event.type === 'hit' && event.move === arc.id)).toBe(
      true,
    );
  });

  it('targets the nearest standing owned creature', () => {
    const subject = setup({
      party: [fighter('far', [move('Strike')]), fighter('near', [move('Strike')])],
      partyTiles: { far: { x: 0, y: 0 }, near: { x: 4, y: 0 } },
    });
    expect(subject.nearestTarget()).toBe('near');
  });

  it('retargets when the nearest is downed', () => {
    const strike = { ...move('Strike'), power: 20 };
    const subject = setup({
      party: [
        fighter('far', [move('Strike')]),
        fighter('near', [move('Strike')], { stats: { vigor: 1, power: 3, speed: 4, focus: 40 } }),
      ],
      enemy: fighter('enemy', [strike]),
      partyTiles: { far: { x: 0, y: 0 }, near: { x: 4.5, y: 0 } },
    });
    subject.useMove('enemy', strike.id, 'near');
    advance(subject, 1);
    expect(subject.nearestTarget()).toBe('far');
  });

  it('wins when the enemy reaches zero', () => {
    const strike = { ...move('Strike'), power: 30 };
    const subject = setup({ party: [fighter('owned', [strike])], enemyTile: { x: 1, y: 0 } });
    subject.useMove('owned', strike.id);
    advance(subject, 1);
    expect(subject.state().phase).toBe('win');
  });

  it('drives the player off when all three are down and the enemy reaches them', () => {
    const sweep = { ...move('Sweep'), power: 30 };
    const party = ['one', 'two', 'three'].map((id) =>
      fighter(id, [move('Strike')], { stats: { vigor: 1, power: 1, speed: 1, focus: 1 } }),
    );
    const subject = setup({
      party,
      enemy: fighter('enemy', [sweep]),
      partyTiles: { one: { x: 4, y: 0 }, two: { x: 4, y: 0 }, three: { x: 4, y: 0 } },
      player: { x: 0, y: 0 },
    });
    subject.useMove('enemy', sweep.id, 'one');
    advance(subject, 2, {}, { x: 4, y: 0 });
    expect(subject.state().phase).toBe('driven-off');
  });

  it('ends the fight when every owned creature is down and the player is across the arena', () => {
    const party = ['loamox', 'mirefin', 'thornwren'].map((id) => {
      const individual = member(id);
      return { ...individual, stats: { ...individual.stats, vigor: 3 } };
    });
    const positions = Object.fromEntries(
      party.map((individual, index) => [individual.id, { x: 8.5 + index * 0.5, y: 2.5 }]),
    );
    const player = { x: 2.5, y: 11.5 };
    const subject = createEncounter({
      party,
      enemy: antlerback(),
      grid: openGrid,
      rng: () => 0,
      partyTiles: positions,
      enemyTile: { x: 9.5, y: 1.5 },
      player,
    });

    for (let time = 0; time < 30 && subject.state().phase === 'fight'; time += 1 / 60)
      subject.update(1 / 60, positions, player);

    expect(subject.state().phase).toBe('driven-off');
    expect(subject.state().elapsed).toBeLessThan(30);
  });

  it('ends the fight when every owned creature is down and the enemy cannot reach the player', () => {
    const sweep = { ...move('Sweep'), power: 30 };
    const party = ['one', 'two', 'three'].map((id) =>
      fighter(id, [move('Strike')], { stats: { vigor: 1, power: 1, speed: 1, focus: 1 } }),
    );
    const subject = setup({
      party,
      enemy: fighter('enemy', [sweep]),
      grid: { isWalkable: () => false },
      partyTiles: { one: { x: 4, y: 0 }, two: { x: 4, y: 0 }, three: { x: 4, y: 0 } },
      enemyTile: { x: 4, y: 0 },
      player: { x: 0, y: 10 },
    });
    subject.useMove('enemy', sweep.id, 'one');
    advance(subject, 10, {}, { x: 0, y: 10 });

    expect(subject.state().phase).toBe('driven-off');
    expect(subject.state().elapsed).toBeLessThan(10);
  });

  it('emits the driven-off event exactly once when the party is wiped', () => {
    const strike = { ...move('Strike'), power: 30 };
    const subject = setup({
      party: [
        fighter('owned', [move('Strike')], { stats: { vigor: 1, power: 1, speed: 1, focus: 1 } }),
      ],
      enemy: fighter('enemy', [strike]),
      enemyTile: { x: 1, y: 0 },
    });
    subject.useMove('enemy', strike.id, 'owned');

    const events = [...advance(subject, 2), ...advance(subject, 2)];
    expect(events.filter((event) => event.type === 'driven-off')).toHaveLength(1);
  });

  it('does not walk the enemy in while a windup is still showing after a party wipe', () => {
    const bolt = { ...move('Bolt'), power: 30 };
    const subject = setup({
      party: [
        fighter('owned', [move('Strike')], { stats: { vigor: 1, power: 1, speed: 1, focus: 1 } }),
      ],
      enemy: fighter('enemy', [bolt, move('Arc')], {
        stats: { vigor: 70, power: 3, speed: 4, focus: 40 },
      }),
      partyTiles: { owned: { x: 4, y: 0 } },
      enemyTile: { x: 0, y: 0 },
      player: { x: 20, y: 0 },
    });
    subject.useMove('enemy', bolt.id, 'owned');
    advance(subject, 1.2);
    expect(subject.state().party[0]!.downed).toBe(true);
    expect(subject.state().enemy.windup).not.toBeNull();

    const tileAtWipe = subject.state().enemy.tile;
    for (let elapsed = 0; elapsed < 0.25; elapsed += 0.05) {
      subject.update(0.05);
      expect(subject.state().enemy.windup).not.toBeNull();
      expect(subject.state().enemy.tile).toEqual(tileAtWipe);
    }
  });

  it('still ends the fight three seconds after a wipe that interrupted a windup', () => {
    const bolt = { ...move('Bolt'), power: 30 };
    const subject = setup({
      party: [
        fighter('owned', [move('Strike')], { stats: { vigor: 1, power: 1, speed: 1, focus: 1 } }),
      ],
      enemy: fighter('enemy', [bolt, move('Arc')], {
        stats: { vigor: 70, power: 3, speed: 4, focus: 40 },
      }),
      partyTiles: { owned: { x: 4, y: 0 } },
      enemyTile: { x: 0, y: 0 },
      player: { x: 20, y: 0 },
    });
    subject.useMove('enemy', bolt.id, 'owned');
    advance(subject, 1.2);
    expect(subject.state().party[0]!.downed).toBe(true);
    expect(subject.state().enemy.windup).not.toBeNull();

    const events = advance(subject, 3.05);
    expect(subject.state().phase).toBe('driven-off');
    expect(events.some((event) => event.type === 'driven-off')).toBe(true);
  });

  it('keeps fighting while one owned creature is still standing', () => {
    const sweep = { ...move('Sweep'), power: 30 };
    const party = ['one', 'two', 'three'].map((id) =>
      fighter(id, [move('Strike')], { stats: { vigor: 1, power: 1, speed: 1, focus: 1 } }),
    );
    const subject = setup({
      party,
      enemy: fighter('enemy', [sweep]),
      grid: { isWalkable: () => false },
      partyTiles: { one: { x: 4, y: 0 }, two: { x: 4, y: 0 }, three: { x: 0, y: 0 } },
      enemyTile: { x: 4, y: 0 },
    });
    subject.useMove('enemy', sweep.id, 'one');
    advance(subject, 10);

    expect(subject.state().party.filter(({ downed }) => downed)).toHaveLength(2);
    expect(subject.state().phase).toBe('fight');
  });

  it('drops flashes once they have expired', () => {
    const strike = move('Strike');
    const subject = setup({ enemyTile: { x: 1, y: 0 } });
    subject.useMove('owned', strike.id);
    for (let time = 0; time < 1; time += 0.05) {
      const events = subject.update(0.05);
      if (events.some((event) => event.type === 'hit')) break;
    }
    expect(subject.state().flashes).not.toHaveLength(0);

    subject.update(0.2);
    expect(subject.state().flashes).toHaveLength(0);
  });

  it('regenerates two focus a second', () => {
    const subject = setup({
      party: [fighter('owned', [move('Strike')])],
      enemyTile: { x: 1, y: 0 },
    });
    subject.useMove('owned', 'strike');
    const before = subject.state().party[0]!.focus;
    subject.update(1);
    expect(subject.state().party[0]!.focus).toBe(before + 2);
  });

  it('holds position for a second when nothing is affordable', () => {
    const subject = setup({ enemyTile: { x: 1, y: 0 } });
    subject.update(0.1);
    const first = subject.state().enemy.tile;
    subject.update(0.8);
    expect(subject.state().enemy.tile).toEqual(first);
  });

  it('does not flee in the arena', () => {
    const subject = setup({
      enemy: fighter('enemy', [move('Strike')], { temperament: 'Skittish' }),
      enemyTile: { x: 1, y: 0 },
    });
    advance(subject, 5);
    expect(subject.state().phase).not.toBe('driven-off');
  });

  it('reports the enemy at the tile it was given', () => {
    expect(setup({ enemyTile: { x: 7.25, y: 9.5 } }).state().enemy.tile).toEqual({
      x: 7.25,
      y: 9.5,
    });
  });

  it('reports the exact hide multiplier on every hit', () => {
    const heat = { ...move('Strike', 'Heat'), power: 30 };
    const subject = setup({
      party: [fighter('owned', [heat])],
      enemy: antlerback(),
      enemyTile: { x: 1, y: 0 },
    });
    subject.useMove('owned', heat.id);
    const hits = advance(subject, 1).filter((event) => event.type === 'hit');
    expect(hits).not.toHaveLength(0);
    expect(hits.every((event) => event.hideMult === 1.6)).toBe(true);
  });

  it('does not walk through a rock', () => {
    const subject = setup({ grid: { isWalkable: (x) => x !== 4 }, enemyTile: { x: 5, y: 0 } });
    advance(subject, 2);
    expect(subject.state().enemy.tile.x).toBeGreaterThanOrEqual(5);
  });

  it('closes the last half tile to land a Strike', () => {
    const subject = setup({
      enemy: fighter('enemy', [move('Strike')], { temperament: 'Bold' }),
      enemyTile: { x: 1.5, y: 0 },
    });

    expect(
      advance(subject, 2).some(
        (event) => event.type === 'hit' && event.attacker === 'enemy' && event.move === 'strike',
      ),
    ).toBe(true);
    expect(subject.state().enemy.tile.x).toBeLessThan(1.5);
  });

  it('falls back to a move that is in range when the closest match is not', () => {
    const subject = setup({ enemy: antlerback(), enemyTile: { x: 1.5, y: 0 } });

    const executed = advance(subject, 3).find(
      (event) => event.type === 'executed' && event.attacker === subject.state().enemy.speciesId,
    );
    expect(executed?.move).toMatch(/(gore|rake|bull-rush)$/);
  });

  it('never goes more than four seconds without acting', () => {
    const target = fighter('owned', [move('Strike')], {
      stats: { vigor: 100_000, power: 1, speed: 1, focus: 0 },
    });
    const subject = setup({
      party: [target],
      enemy: antlerback(),
      enemyTile: { x: 1.5, y: 0 },
    });
    const actedAt: number[] = [];
    for (let elapsed = 0; elapsed < 60; elapsed += 0.05) {
      const events = subject.update(0.05);
      if (events.some((event) => event.type === 'executed' && event.attacker === 'antlerback'))
        actedAt.push(subject.state().elapsed);
    }

    expect(actedAt.length).toBeGreaterThan(1);
    expect(Math.max(...actedAt.slice(1).map((at, index) => at - actedAt[index]!))).toBeLessThan(4);
  });

  it('runs a full Antlerback encounter to a win under a slow policy', () => {
    const party = ['emberjack', 'loamox', 'bramblehog'].map((id) => {
      const individual = member(id);
      return { ...individual, stats: { ...individual.stats, vigor: 1000 } };
    });
    const positions = Object.fromEntries(
      party.map((individual, index) => [individual.id, { x: index - 1, y: 5 }]),
    ) as Record<string, Point>;
    const subject = createEncounter({
      party,
      enemy: antlerback(),
      grid: openGrid,
      rng: fixed,
      partyTiles: positions,
      enemyTile: { x: 0, y: 0 },
      player: { x: 0, y: 6 },
    });
    for (let elapsed = 0; elapsed < 90 && subject.state().phase === 'fight'; elapsed += 0.05) {
      const state = subject.state();
      for (const combatant of state.party.slice(0, 1)) {
        if (combatant.desiredTile) positions[combatant.id] = { ...combatant.desiredTile };
        const individual = party.find(({ id }) => id === combatant.id)!;
        const available = individual.repertoire
          .filter(
            (candidate) =>
              combatant.cooldowns[candidate.id]!.remaining <= 0 &&
              combatant.focus >= deliveries[candidate.delivery].focus,
          )
          .sort((a, b) => b.power - a.power)[0];
        if (available && Math.abs(elapsed / 5 - Math.round(elapsed / 5)) < 0.001)
          subject.useMove(combatant.id, available.id);
      }
      subject.update(0.05, positions);
    }
    expect(subject.state().phase).toBe('win');
    expect(subject.state().elapsed).toBeGreaterThanOrEqual(30);
    expect(subject.state().elapsed).toBeLessThanOrEqual(90);
  });
});
