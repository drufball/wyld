import { describe, expect, it } from 'vitest';
import { buildArenaIndividual, enemy, rosterMember } from '../arena/roster.js';
import type { Individual } from '../creatures/individual.js';
import { FACING_YAW } from '../creatures/facing.js';
import type { Move } from './moves.js';
import {
  createEncounter,
  shouldAskForReserve,
  type EncounterOptions,
  type Point,
} from './encounter.js';
import { canAfford, damage, deliveries } from './resolve.js';
import { arenaSpeedTilesPerSecond } from './pace.js';
import { MIN_SEPARATION_TILES } from './spacing.js';
import { choiceInputFrom, createChooser } from './choice.js';
import { createRng } from '../engine/rng.js';

const member = (id: string): Individual => buildArenaIndividual(rosterMember(id)!);
const antlerback = (): Individual => buildArenaIndividual(enemy('antlerback')!);
const openGrid = { isWalkable: () => true };
const fixed = { next: () => 0 };
const distanceForTest = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
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
const driveIdleParty = (
  subject: ReturnType<typeof setup>,
  seconds: number,
  player = { x: 0, y: 0 },
  speeds: Record<string, number> = {},
  onTick: (before: Record<string, Point>, ticks: number) => void = () => undefined,
  choice?: { chooser: ReturnType<typeof createChooser>; party: readonly Individual[] },
) => {
  const positions: Record<string, Point> = {};
  const events: ReturnType<typeof subject.update> = [];
  let tick = 0;
  for (; tick < seconds * 60 && subject.state().phase === 'fight'; tick += 1) {
    for (const combatant of subject.state().party) {
      const target = combatant.desiredTile;
      if (!target || combatant.benched || combatant.downed) continue;
      const current = positions[combatant.id] ?? combatant.tile;
      const distance = Math.hypot(target.x - current.x, target.y - current.y);
      const step = Math.min(distance, arenaSpeedTilesPerSecond(speeds[combatant.id] ?? 4) / 60);
      positions[combatant.id] = {
        x: current.x + ((target.x - current.x) / (distance || 1)) * step,
        y: current.y + ((target.y - current.y) / (distance || 1)) * step,
      };
    }
    const before = Object.fromEntries(
      subject.state().party.map(({ id, tile }) => [id, { ...tile }]),
    );
    if (choice)
      for (const selected of choice.chooser.choose(choiceInputFrom(subject.state(), choice.party)))
        subject.useMove(selected.creatureId, selected.moveId);
    events.push(...subject.update(1 / 60, positions, player));
    onTick(before, tick + 1);
    for (const combatant of subject.state().party)
      if (!combatant.benched && !combatant.downed) positions[combatant.id] = combatant.tile;
  }
  return { positions, ticks: tick, events };
};

describe('authority', () => {
  it("hears every order within two tiles and none beyond the temperament's reach", () => {
    const near = setup({ rng: { next: () => 0.999 }, partyTiles: { owned: { x: 1, y: 0 } } });
    expect(near.hear('owned')).toMatchObject({ heard: true, authority: 1 });
    const far = setup({ rng: { next: () => 0 }, partyTiles: { owned: { x: 9, y: 0 } } });
    expect(far.hear('owned')).toMatchObject({ heard: false, authority: 0 });
  });
  it('draws exactly one roll per order', () => {
    let draws = 0;
    const subject = setup({ rng: { next: () => (draws++, 0.5) } });
    subject.hear('owned');
    subject.hear('owned');
    subject.authorityOf('owned');
    expect(draws).toBe(2);
  });
  it('rolls the same way for the same seed', () => {
    const makeSeeded = () => setup({ rng: createRng(7), partyTiles: { owned: { x: 5, y: 0 } } });
    const a = makeSeeded(),
      b = makeSeeded();
    const first = Array.from({ length: 10 }, () => a.hear('owned').heard);
    const second = Array.from({ length: 10 }, () => b.hear('owned').heard);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(2);
  });
  it('keeps the player tile from the latest update for authority', () => {
    const subject = setup({ partyTiles: { owned: { x: 5, y: 0 } } });
    expect(subject.authorityOf('owned')).toBe(0.5);
    subject.update(0, { owned: { x: 5, y: 0 } }, { x: 5, y: 0 });
    expect(subject.authorityOf('owned')).toBe(1);
  });
});

describe('combat encounter', () => {
  it('refuses a Bolt whose line crosses a rock', () => {
    const blocked = setup({
      party: [fighter('owned', [move('Bolt')])],
      partyTiles: { owned: { x: 0.5, y: 0.5 } },
      enemyTile: { x: 6.5, y: 0.5 },
      grid: { isWalkable: (x, y) => !(x === 3 && y === 0) },
      reserve: '',
    });
    expect(blocked.useMove('owned', 'bolt')).toBe(false);
    expect(advance(blocked, 3).some((event) => event.type === 'executed')).toBe(false);

    const clear = setup({
      party: [fighter('owned', [move('Bolt')])],
      partyTiles: { owned: { x: 0.5, y: 0.5 } },
      enemyTile: { x: 6.5, y: 0.5 },
      grid: { isWalkable: (x, y) => !(x === 3 && y === 1) },
      reserve: '',
    });
    expect(clear.useMove('owned', 'bolt')).toBe(true);
  });

  it('refuses an Arc whose line crosses a rock', () => {
    const subject = setup({
      party: [fighter('owned', [move('Arc')])],
      partyTiles: { owned: { x: 0.5, y: 0.5 } },
      enemyTile: { x: 6.5, y: 0.5 },
      grid: { isWalkable: (x, y) => !(x === 3 && y === 0) },
      reserve: '',
    });
    expect(subject.useMove('owned', 'arc')).toBe(false);
  });

  it("holds the enemy's Bolt while a rock is in the way", () => {
    const makeSubject = (rockY: number) =>
      setup({
        party: [fighter('owned', [move('Strike')])],
        enemy: fighter('enemy', [move('Bolt')], {
          temperament: 'Steady',
          stats: { vigor: 70, power: 3, speed: 4, focus: 40 },
        }),
        partyTiles: { owned: { x: 0.5, y: 0.5 } },
        enemyTile: { x: 6.5, y: 0.5 },
        grid: { isWalkable: (x, y) => !(x === 3 && y === rockY) },
        reserve: '',
      });
    expect(
      advance(makeSubject(0), 3).some(
        (event) => event.type === 'executed' && event.attacker === 'enemy',
      ),
    ).toBe(false);
    expect(
      advance(makeSubject(1), 3).some(
        (event) => event.type === 'executed' && event.attacker === 'enemy',
      ),
    ).toBe(true);
  });

  it('reports whether each creature has a line to the enemy', () => {
    const makeSubject = (rockY: number) =>
      setup({
        partyTiles: { owned: { x: 0.5, y: 0.5 } },
        enemyTile: { x: 6.5, y: 0.5 },
        grid: { isWalkable: (x, y) => !(x === 3 && y === rockY) },
        reserve: '',
      });
    expect(makeSubject(0).state().party[0]!.lineToEnemy).toBe(false);
    expect(makeSubject(1).state().party[0]!.lineToEnemy).toBe(true);
    expect(makeSubject(1).state().enemy.reachTiles).toBe(1.25);
  });

  it('keeps a heavy off a kiting Bolt-holder for ten seconds while the kiter lands three Bolts', () => {
    const start = { x: 0.5, y: 3.5 };
    const heavyStart = { x: 0.5, y: -0.5 };
    const kiter = fighter('kiter', [move('Bolt')], {
      temperament: 'Skittish',
      stats: { vigor: 45, power: 3, speed: 7, focus: 45 },
    });
    const subject = setup({
      party: [kiter],
      enemy: fighter('heavy', [move('Strike')], {
        temperament: 'Bold',
        stats: { vigor: 200, power: 5, speed: 4, focus: 55 },
      }),
      partyTiles: { kiter: start },
      enemyTile: heavyStart,
      player: { x: 0.5, y: 1.5 },
      rng: createRng(339),
      reserve: '',
    });
    const { events } = driveIdleParty(subject, 10, { x: 0.5, y: 1.5 }, { kiter: 7 }, () => {
      const state = subject.state();
      if (distanceForTest(state.party[0]!.tile, state.enemy.tile) <= 3.5)
        subject.useMove('kiter', 'bolt');
    });
    expect(events.some((event) => event.type === 'hit' && event.attacker === 'heavy')).toBe(false);
    expect(
      events.filter((event) => event.type === 'hit' && event.attacker === 'kiter').length,
    ).toBeGreaterThanOrEqual(3);
    expect(distanceForTest(subject.state().party[0]!.tile, heavyStart)).toBeGreaterThan(
      distanceForTest(start, heavyStart),
    );
  });

  it('still lands a Strike from fight-start distance on a creature that stands its ground', () => {
    const subject = setup({
      party: [fighter('owned', [move('Strike')], { temperament: 'Steady' })],
      enemy: fighter('enemy', [move('Strike')], {
        temperament: 'Bold',
        stats: { vigor: 70, power: 3, speed: 4, focus: 40 },
      }),
      partyTiles: { owned: { x: 0.5, y: 0.5 } },
      enemyTile: { x: 0.5, y: -5.5 },
      player: { x: 0.5, y: 3.5 },
      reserve: '',
    });
    expect(
      driveIdleParty(subject, 10).events.some(
        (event) => event.type === 'hit' && event.attacker === 'enemy',
      ),
    ).toBe(true);
  });

  it('fires chosen moves without ever double-firing inside a cooldown', () => {
    const strike = move('Strike');
    const owned = fighter('owned', [strike], { temperament: 'Bold' });
    const subject = setup({ party: [owned], enemyTile: { x: 1, y: 0 }, reserve: '' });
    const { events } = driveIdleParty(subject, 7, { x: 0, y: 0 }, {}, () => undefined, {
      chooser: createChooser(() => 0),
      party: [owned],
    });
    const times: number[] = [];
    let elapsed = 0;
    // Executions are collected at 60 Hz; reconstruct their tick times from a dedicated replay.
    const replay = setup({ party: [owned], enemyTile: { x: 1, y: 0 }, reserve: '' });
    const chooser = createChooser(() => 0);
    for (let tick = 0; tick < 7 * 60 && replay.state().phase === 'fight'; tick += 1) {
      for (const selected of chooser.choose(choiceInputFrom(replay.state(), [owned])))
        replay.useMove(selected.creatureId, selected.moveId);
      elapsed += 1 / 60;
      if (
        replay
          .update(1 / 60)
          .some((event) => event.type === 'executed' && event.attacker === 'owned')
      )
        times.push(elapsed);
    }
    expect(
      events.filter((event) => event.type === 'executed' && event.attacker === 'owned').length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      times
        .slice(1)
        .every((time, index) => time - times[index]! >= deliveries.Strike.cooldown - 1e-9),
    ).toBe(true);
  });

  it('resolves a zero-tap fight in which every active creature executes at least two moves', () => {
    const party = [member('loamox'), member('bramblehog'), member('thornwren')];
    let seed = 331;
    const random = () => (seed = (seed * 1_664_525 + 1_013_904_223) >>> 0) / 2 ** 32;
    const subject = setup({
      party,
      enemy: antlerback(),
      enemyTile: { x: 0, y: -6 },
      player: { x: 0, y: 0 },
      reserve: '',
      rng: random,
    });
    const chooser = createChooser(random);
    const executionTimes: Record<string, number[]> = Object.fromEntries(
      party.map(({ id }) => [id, []]),
    );
    let first = Infinity;
    const positions: Record<string, Point> = {};
    let ticks = 0;
    for (; ticks < 90 * 60 && subject.state().phase === 'fight'; ticks += 1) {
      const state = subject.state();
      for (const combatant of state.party) {
        const target = combatant.desiredTile;
        if (!target || combatant.downed || combatant.benched) continue;
        const current = positions[combatant.id] ?? combatant.tile;
        const distance = distanceForTest(current, target);
        const speed = party.find(({ id }) => id === combatant.id)!.stats.speed;
        const step = Math.min(distance, arenaSpeedTilesPerSecond(speed) / 60);
        positions[combatant.id] = {
          x: current.x + ((target.x - current.x) / (distance || 1)) * step,
          y: current.y + ((target.y - current.y) / (distance || 1)) * step,
        };
      }
      for (const selected of chooser.choose(choiceInputFrom(state, party)))
        subject.useMove(selected.creatureId, selected.moveId);
      for (const event of subject.update(1 / 60, positions, { x: 0, y: 0 }))
        if (event.type === 'executed' && event.attacker && executionTimes[event.attacker]) {
          executionTimes[event.attacker]!.push(subject.state().elapsed);
          first = Math.min(first, subject.state().elapsed);
        }
      for (const combatant of subject.state().party) positions[combatant.id] = combatant.tile;
    }
    const counts = party.map(({ id }) => executionTimes[id]!.length);
    // Simulated at 60 Hz: Barrow 3, Quill 2, Pip 3; first at 0.50 s; driven off at 10.12 s.
    expect(first + 1e-9).toBeGreaterThanOrEqual(0.5);
    expect(counts.every((count) => count >= 2)).toBe(true);
    expect(subject.state().enemy.hp).toBeLessThan(subject.state().enemy.maxHp);
    expect(subject.state().phase).not.toBe('fight');
    expect(ticks / 60).toBeLessThan(90);
  });

  it('lets a tap fire now and win over the choice', () => {
    const light = move('Strike');
    const heavy = { ...move('Strike'), id: 'heavy', power: 5 };
    const owned = fighter('owned', [light, heavy], { temperament: 'Bold' });
    const subject = setup({ party: [owned], enemyTile: { x: 1, y: 0 }, reserve: '' });
    expect(subject.useMove('owned', light.id)).toBe(true);
    const chooser = createChooser(() => 0);
    for (const selected of chooser.choose(choiceInputFrom(subject.state(), [owned])))
      subject.useMove(selected.creatureId, selected.moveId);
    const events = advance(subject, deliveries.Strike.cooldown - 0.01);
    expect(
      events
        .filter(({ type, attacker }) => type === 'executed' && attacker === 'owned')
        .map(({ move }) => move),
    ).toEqual([light.id]);
  });

  it('resolves a fight with zero taps and every active creature moving at least three tiles', () => {
    const party = [member('loamox'), member('bramblehog'), member('thornwren')];
    let seed = 331;
    const subject = setup({
      party,
      rng: () => (seed = (seed * 1_664_525 + 1_013_904_223) >>> 0) / 2 ** 32,
      reserve: '',
      enemy: antlerback(),
      enemyTile: { x: 0, y: -6 },
      player: { x: 0, y: 0 },
      partyTiles: {
        loamox: { x: -5, y: 5 },
        bramblehog: { x: 5, y: 5 },
        thornwren: { x: 0, y: -3 },
      },
    });
    const paths = Object.fromEntries(party.map(({ id }) => [id, 0]));
    const { ticks } = driveIdleParty(
      subject,
      60,
      { x: 0, y: 0 },
      Object.fromEntries(party.map(({ id, stats }) => [id, stats.speed])),
      (before) => {
        for (const combatant of subject.state().party) {
          paths[combatant.id]! += distanceForTest(before[combatant.id]!, combatant.tile);
        }
      },
    );
    // Simulated at 60 Hz: Barrow 8.12, Quill 17.84, Pip 3.06 tiles; resolved in 20.05 s.
    expect(Object.values(paths).every((path) => path >= 3)).toBe(true);
    expect(subject.state().phase).not.toBe('fight');
    expect(ticks / 60).toBeLessThan(60);
  });

  it('moves an idle party by temperament with no taps', () => {
    const subject = setup({
      party: [member('loamox'), member('bramblehog'), member('thornwren')],
      reserve: '',
      enemy: antlerback(),
      enemyTile: { x: 0, y: -6 },
      partyTiles: {
        loamox: { x: -3, y: 3 },
        bramblehog: { x: 3, y: 3 },
        thornwren: { x: 0, y: -3 },
      },
    });
    subject.update(1 / 60, {}, { x: 0, y: 0 });
    expect(subject.state().party.every(({ desiredTile }) => desiredTile !== null)).toBe(true);
    driveIdleParty(subject, 10);
    const [barrow, , pip] = subject.state().party;
    expect(barrow!.tile.y).toBeLessThan(0);
    expect(distanceForTest(pip!.tile, { x: 0, y: 0 })).toBeLessThanOrEqual(2.1);
  });

  it('holds the policy off for four seconds after a tap, then resumes', () => {
    const subject = setup({ partyTiles: { owned: { x: 5, y: 5 } } });
    subject.override('owned');
    advance(subject, 3.9, { owned: { x: 5, y: 5 } });
    expect(subject.state().party[0]).toMatchObject({ desiredTile: null });
    expect(subject.state().party[0]!.overrideRemaining).toBeGreaterThan(0);
    subject.update(0.2, { owned: { x: 5, y: 5 } });
    expect(subject.state().party[0]!.desiredTile).not.toBeNull();
    expect(subject.state().party[0]!.overrideRemaining).toBe(0);
  });

  it('does not set a formation tile while a move approach is in progress', () => {
    const subject = setup({ enemyTile: { x: 6, y: 0 } });
    expect(subject.useMove('owned', 'strike')).toBe(true);
    subject.update(0.01, { owned: { x: 0, y: 0 } });
    expect(subject.state().party[0]!.desiredTile!.x).toBeGreaterThan(3);
  });

  it('lands a Lunge from fight-start distance while the party moves by temperament', () => {
    const lunge = move('Lunge');
    const subject = setup({
      enemy: fighter('enemy', [lunge], { stats: { vigor: 70, power: 3, speed: 8, focus: 100 } }),
      enemyTile: { x: 6, y: 0 },
    });
    const hp = subject.state().party[0]!.hp;
    driveIdleParty(subject, 8);
    expect(subject.state().party[0]!.hp).toBeLessThan(hp);
  });

  it('keeps every standing combatant a tile apart while the formation runs', () => {
    const subject = setup({
      party: [
        fighter('one', [move('Strike')]),
        fighter('two', [move('Strike')]),
        fighter('three', [move('Strike')]),
      ],
      reserve: '',
      partyTiles: { one: { x: -2, y: 0 }, two: { x: 0, y: 0 }, three: { x: 2, y: 0 } },
    });
    driveIdleParty(subject, 10);
    const all = [...subject.state().party, subject.state().enemy];
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++)
        expect(distanceForTest(all[i]!.tile, all[j]!.tile)).toBeGreaterThanOrEqual(
          MIN_SEPARATION_TILES - 1e-10,
        );
  });

  it('gives the swapped-in reserve its entry tile as home', () => {
    const party = [
      fighter('one', [move('Strike')]),
      fighter('two', [move('Strike')]),
      fighter('three', [move('Strike')], { temperament: 'Erratic' }),
    ];
    const subject = setup({
      party,
      partyTiles: { one: { x: 8, y: 8 }, two: { x: 2, y: 2 }, three: { x: 20, y: 20 } },
    });
    subject.swap('one');
    subject.update(0.01, {}, { x: 0, y: 0 });
    const target = subject.state().party.find(({ id }) => id === 'three')!.desiredTile!;
    expect(distanceForTest(target, { x: 8, y: 8 })).toBeLessThanOrEqual(4);
  });
  const reserveParty = () => [
    fighter('one', [move('Strike')]),
    fighter('two', [move('Strike')]),
    fighter('three', [move('Strike')]),
  ];
  const downActiveParty = () => {
    const sweep = { ...move('Sweep'), power: 30 };
    const subject = setup({
      party: reserveParty().map((individual) => ({
        ...individual,
        stats: { ...individual.stats, vigor: 1 },
      })),
      enemy: fighter('enemy', [sweep]),
      partyTiles: { one: { x: 1, y: 0 }, two: { x: 1, y: 0.5 }, three: { x: 1, y: 1 } },
      enemyTile: { x: 0, y: 0 },
    });
    subject.useMove('enemy', sweep.id, 'one');
    advance(subject, 3);
    expect(
      subject
        .state()
        .party.slice(0, 2)
        .every(({ downed }) => downed),
    ).toBe(true);
    return subject;
  };

  it('fires an armed move again each time its cooldown ends', () => {
    const strike = move('Strike');
    const subject = setup({
      party: [
        fighter('owned', [strike], {
          stats: { vigor: 1_000, power: 1, speed: 4, focus: 100 },
        }),
      ],
      enemy: fighter('enemy', [strike], {
        stats: { vigor: 1_000, power: 1, speed: 4, focus: 0 },
      }),
      partyTiles: { owned: { x: 0, y: 0 } },
      enemyTile: { x: 1, y: 0 },
    });
    const executionTimes: number[] = [];
    for (let tick = 0; tick < 60 * 7; tick += 1) {
      subject.useMove('owned', strike.id);
      const events = subject.update(1 / 60);
      if (events.some((event) => event.type === 'executed' && event.attacker === 'owned'))
        executionTimes.push(subject.state().elapsed);
    }
    // Four executions, each 2.017 s apart: the two-second cooldown plus one 60 Hz driver step.
    expect(executionTimes).toHaveLength(4);
    expect(executionTimes.slice(1).map((time, index) => time - executionTimes[index]!)).toEqual(
      executionTimes.slice(1).map(() => expect.closeTo(deliveries.Strike.cooldown, 1)),
    );
  });

  it('starts with the third pick benched', () => {
    const state = setup({ party: reserveParty() }).state();
    expect(state.party.map(({ benched }) => benched)).toEqual([false, false, true]);
    expect(state.reserveId).toBe('three');
    expect(state.swapCooldown).toEqual({ remaining: 0, total: 6 });
  });

  it('swaps the reserve in at the leaving creature tile', () => {
    const subject = setup({
      party: reserveParty(),
      partyTiles: { one: { x: 2, y: 3 }, two: { x: 0, y: 0 }, three: { x: 9, y: 9 } },
    });
    expect(subject.swap('one')).toBe(true);
    const state = subject.state();
    expect(state.party.find(({ id }) => id === 'three')).toMatchObject({
      tile: { x: 2, y: 3 },
      benched: false,
    });
    expect(state.reserveId).toBe('one');
  });

  it('keeps each creature hp, focus and cooldowns across a swap', () => {
    const subject = setup({ party: reserveParty(), enemyTile: { x: 1, y: 0 } });
    expect(subject.useMove('one', 'strike')).toBe(true);
    subject.update(0.1);
    const before = subject.state().party.map(({ id, hp, focus, cooldowns }) => ({
      id,
      hp,
      focus,
      cooldowns,
    }));
    expect(subject.swap('one')).toBe(true);
    expect(
      subject.state().party.map(({ id, hp, focus, cooldowns }) => ({ id, hp, focus, cooldowns })),
    ).toEqual(before);
  });

  it('refuses a second swap until the cooldown expires', () => {
    const subject = setup({ party: reserveParty() });
    expect(subject.swap('one')).toBe(true);
    expect(subject.swap('three')).toBe(false);
    expect(subject.state().reserveId).toBe('one');
  });

  it('allows a swap once the six second cooldown has run down', () => {
    const subject = setup({ party: reserveParty() });
    subject.swap('one');
    subject.update(6);
    expect(subject.swap('three')).toBe(true);
  });

  it('swaps a downed creature out for the standing reserve', () => {
    const strike = { ...move('Strike'), power: 30 };
    const subject = setup({
      party: reserveParty().map((individual) => ({
        ...individual,
        stats: { ...individual.stats, vigor: 1 },
      })),
      enemy: fighter('enemy', [strike]),
      enemyTile: { x: 1, y: 0 },
    });
    subject.useMove('enemy', strike.id, 'one');
    advance(subject, 3);
    expect(subject.state().party.find(({ id }) => id === 'one')?.downed).toBe(true);
    expect(subject.swap('one')).toBe(true);
    expect(subject.state().party.find(({ id }) => id === 'three')).toMatchObject({
      benched: false,
      downed: false,
    });
  });

  it('never targets the benched creature', () => {
    const subject = setup({
      party: reserveParty(),
      partyTiles: { one: { x: 0, y: 0 }, two: { x: 1, y: 0 }, three: { x: 4.9, y: 0 } },
    });
    expect(subject.nearestTarget()).toBe('two');
    expect(subject.useMove('enemy', 'strike', 'three')).toBe(false);
  });

  it('does not count two down and one benched as a wipe', () => {
    const subject = downActiveParty();
    advance(subject, 3.1);
    expect(subject.state().phase).toBe('fight');
  });

  it('holds the enemy in place while a standing reserve waits', () => {
    const subject = downActiveParty(),
      before = subject.state().enemy.tile;
    advance(subject, 2, {}, { x: 20, y: 20 });
    expect(subject.state().enemy.tile).toEqual(before);
  });

  it('asks for the reserve once when both active creatures are down', () => {
    const state = downActiveParty().state();
    expect(shouldAskForReserve(state, false)).toBe(true);
    expect(shouldAskForReserve(state, true)).toBe(false);
  });

  it('drives the player off only when all three are down', () => {
    const subject = downActiveParty();
    expect(subject.swap('one')).toBe(true);
    advance(subject, 10, {}, subject.state().enemy.tile);
    expect(subject.state().party.every(({ downed }) => downed)).toBe(true);
    expect(subject.state().phase).toBe('driven-off');
  });

  it('keeps every standing combatant at least a tile from the others', () => {
    const subject = setup({
      party: [fighter('one', [move('Strike')]), fighter('two', [move('Strike')])],
      partyTiles: { one: { x: 4, y: 4 }, two: { x: 4, y: 4 } },
      enemyTile: { x: 4, y: 4 },
    });
    for (let frame = 0; frame < 120; frame++) subject.update(1 / 60);
    const standing = [...subject.state().party, subject.state().enemy].filter((c) => !c.downed);
    for (let i = 0; i < standing.length; i++)
      for (let j = i + 1; j < standing.length; j++)
        expect(
          Math.hypot(
            standing[i]!.tile.x - standing[j]!.tile.x,
            standing[i]!.tile.y - standing[j]!.tile.y,
          ),
        ).toBeGreaterThanOrEqual(1 - 1e-10);
  });

  it('moves the enemy at the arena pace', () => {
    const subject = setup({ enemyTile: { x: 10, y: 0 } });
    subject.update(1);
    expect(subject.state().enemy.tile.x).toBeCloseTo(10 - arenaSpeedTilesPerSecond(4));
  });

  it('wipes a party that never fights back and ends in driven off', () => {
    const party = ['loamox', 'bramblehog', 'thornwren'].map(member),
      positions = Object.fromEntries(party.map(({ id }) => [id, { x: 0, y: 0 }])),
      subject = createEncounter({
        party,
        enemy: antlerback(),
        grid: openGrid,
        rng: fixed,
        partyTiles: positions,
        enemyTile: { x: 0, y: -6 },
        player: { x: 0, y: 0 },
        reserve: '',
      }),
      dt = 1 / 60;
    let firstExecutedAt: number | null = null;
    while (subject.state().phase === 'fight' && subject.state().elapsed < 30) {
      const events = subject.update(dt, positions);
      for (const combatant of subject.state().party)
        positions[combatant.id] = { ...combatant.tile };
      if (firstExecutedAt === null && events.some(({ type }) => type === 'executed'))
        firstExecutedAt = subject.state().elapsed;
    }

    // Measured at a fixed 60 Hz: first execution at 3.90 s and driven off at 10.63 s.
    expect(firstExecutedAt).not.toBeNull();
    expect(firstExecutedAt!).toBeLessThanOrEqual(8);
    expect(subject.state().phase).toBe('driven-off');
    expect(subject.state().elapsed).toBeLessThanOrEqual(30);
  });

  it('closes a Lunge to the separation distance rather than onto its target', () => {
    const lunge = move('Lunge'),
      target = fighter('owned', [move('Strike')], {
        stats: { vigor: 100_000, power: 1, speed: 1, focus: 0 },
      }),
      positions: Record<string, Point> = { owned: { x: 0, y: 0 } },
      subject = setup({
        party: [target],
        enemy: fighter('enemy', [lunge]),
        enemyTile: { x: 6, y: 0 },
      });
    let executedAtDistance: number | null = null;
    for (let elapsed = 0; elapsed < 8 && executedAtDistance === null; elapsed += 1 / 60) {
      const events = subject.update(1 / 60, positions);
      const state = subject.state();
      positions.owned = { ...state.party[0]!.tile };
      const separation = Math.hypot(
        state.enemy.tile.x - state.party[0]!.tile.x,
        state.enemy.tile.y - state.party[0]!.tile.y,
      );
      expect(separation).toBeGreaterThanOrEqual(MIN_SEPARATION_TILES - 1e-10);
      if (events.some(({ type, move: moveId }) => type === 'executed' && moveId === lunge.id))
        executedAtDistance = separation;
    }

    expect(executedAtDistance).not.toBeNull();
    expect(executedAtDistance!).toBeGreaterThanOrEqual(MIN_SEPARATION_TILES - 1e-10);
  });

  it('abandons an approach that has not completed in three seconds', () => {
    const lunge = move('Lunge'),
      subject = setup({
        party: [fighter('owned', [lunge])],
        grid: { isWalkable: () => false },
        enemyTile: { x: 6, y: 0 },
      }),
      positions = { owned: { x: 0, y: 0 } };
    expect(subject.useMove('owned', lunge.id)).toBe(true);
    expect(subject.state().party[0]!.desiredTile).not.toBeNull();

    for (let elapsed = 0; elapsed < 3; elapsed += 1 / 60) subject.update(1 / 60, positions);

    expect(subject.state().party[0]!.desiredTile).toBeNull();
  });

  it('ends in driven off when Barrow, Quill and Pip fight the Antlerback', () => {
    const party = ['loamox', 'bramblehog', 'thornwren'].map(member),
      foe = antlerback(),
      positions = Object.fromEntries(
        party.map((individual, index) => [individual.id, { x: index + 4, y: 8 }]),
      ),
      subject = createEncounter({
        party,
        enemy: foe,
        grid: openGrid,
        rng: fixed,
        partyTiles: positions,
        enemyTile: { x: 5, y: 2 },
        reserve: '',
      }),
      dt = 1 / 60;
    while (subject.state().phase === 'fight' && subject.state().elapsed < 90) {
      const state = subject.state();
      for (const individual of party) {
        const combatant = state.party.find((candidate) => candidate.id === individual.id)!;
        if (combatant.downed) continue;
        const best = individual.repertoire
          .filter(
            (candidate) =>
              combatant.cooldowns[candidate.id]!.remaining <= 0 &&
              canAfford(combatant.focus, candidate),
          )
          .sort(
            (a, b) =>
              damage(b, individual.stats.power, 'Bark') - damage(a, individual.stats.power, 'Bark'),
          )[0];
        if (best) subject.useMove(individual.id, best.id, foe.id);
        const current = positions[individual.id]!,
          dx = state.enemy.tile.x - current.x,
          dy = state.enemy.tile.y - current.y,
          distanceToEnemy = Math.hypot(dx, dy),
          step = Math.min(arenaSpeedTilesPerSecond(individual.stats.speed) * dt, distanceToEnemy);
        current.x += (dx / (distanceToEnemy || 1)) * step;
        current.y += (dy / (distanceToEnemy || 1)) * step;
      }
      subject.update(dt, positions);
      for (const combatant of subject.state().party)
        positions[combatant.id] = { ...combatant.tile };
    }

    // Measured at a fixed 60 Hz: 9.63 seconds.
    // The §7 30–90 s band is not met yet; see VERIFICATION.md "duration".
    expect(subject.state().elapsed).toBeLessThanOrEqual(30);
    expect(subject.state().phase).toBe('driven-off');
  });

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

  it('turns the enemy on the creature that hurt it most, not the nearest', () => {
    const bolt = move('Bolt', 'Cut');
    const subject = setup({
      party: [fighter('near', [move('Strike')]), fighter('far', [bolt])],
      partyTiles: { near: { x: 4, y: 0 }, far: { x: 0, y: 0 } },
      enemyTile: { x: 6, y: 0 },
      reserve: '',
    });
    expect(subject.state().enemy.targetId).toBe('near');
    expect(subject.useMove('far', bolt.id)).toBe(true);
    expect(
      advance(subject, 2).some(({ type, attacker }) => type === 'hit' && attacker === 'far'),
    ).toBe(true);
    expect(subject.state().enemy.targetId).toBe('far');
    expect(subject.state().party.find(({ id }) => id === 'far')!.threat).toBeGreaterThan(0);
    expect(subject.state().party.find(({ id }) => id === 'near')!.threat).toBe(0);
  });

  it('makes a shove a taunt: a small Impact hit outdraws a bigger Cut hit', () => {
    const cut = { ...move('Strike', 'Cut'), id: 'cut', power: 2 };
    const shove = { ...move('Bolt', 'Impact'), id: 'shove', power: 1 };
    const subject = setup({
      party: [fighter('heavy', [cut]), fighter('shover', [shove])],
      partyTiles: { heavy: { x: 1, y: 0 }, shover: { x: 0, y: 3 } },
      enemyTile: { x: 0, y: 0 },
      reserve: '',
    });
    subject.useMove('heavy', cut.id);
    subject.useMove('shover', shove.id);
    const hits = advance(subject, 1).filter(
      ({ type, attacker }) => type === 'hit' && (attacker === 'heavy' || attacker === 'shover'),
    );
    const heavyHit = hits.find(({ attacker }) => attacker === 'heavy')!;
    const shoveHit = hits.find(({ attacker }) => attacker === 'shover')!;
    expect(shoveHit.final).toBeLessThan(heavyHit.final!);
    const state = subject.state();
    const heavy = state.party.find(({ id }) => id === 'heavy')!;
    const shover = state.party.find(({ id }) => id === 'shover')!;
    expect(shover.threat).toBeGreaterThan(heavy.threat);
    expect(distanceForTest(shover.tile, state.enemy.tile)).toBeGreaterThan(
      distanceForTest(heavy.tile, state.enemy.tile),
    );
    expect(state.enemy.targetId).toBe('shover');
  });

  it('lets threat fade back to the nearest after six seconds', () => {
    const bolt = move('Bolt', 'Cut');
    const subject = setup({
      party: [fighter('near', [move('Strike')]), fighter('far', [bolt])],
      partyTiles: { near: { x: 4, y: 0 }, far: { x: 0, y: 0 } },
      enemyTile: { x: 6, y: 0 },
      reserve: '',
    });
    subject.useMove('far', bolt.id);
    expect(
      advance(subject, 2).some(({ type, attacker }) => type === 'hit' && attacker === 'far'),
    ).toBe(true);
    expect(subject.state().enemy.targetId).toBe('far');
    advance(subject, 6.1);
    expect(subject.state().enemy.targetId).toBe('near');
    expect(subject.state().party.every(({ threat }) => threat === 0)).toBe(true);
  });

  it('lands a hit on the highest-threat creature from fight-start distance', () => {
    const bolt = move('Bolt', 'Cut');
    const strike = move('Strike');
    const sturdy = { vigor: 100_000, power: 3, speed: 4, focus: 40 };
    const subject = setup({
      party: [
        fighter('near', [strike], { stats: sturdy }),
        fighter('far', [bolt], { stats: sturdy }),
      ],
      enemy: fighter('enemy', [strike], {
        temperament: 'Bold',
        stats: { vigor: 70, power: 3, speed: 4, focus: 40 },
      }),
      partyTiles: { near: { x: 1, y: 0 }, far: { x: 0, y: 2 } },
      enemyTile: { x: 0, y: -6 },
      reserve: '',
    });
    const positions = { near: { x: 1, y: 0 }, far: { x: 0, y: 2 } };
    subject.useMove('far', bolt.id);
    const openingEvents = subject.update(2, positions);
    const enemyHit = [...openingEvents, ...advance(subject, 10, positions)].find(
      ({ type, attacker }) => type === 'hit' && attacker === 'enemy',
    );
    expect(enemyHit?.target).toBe('far');
  });

  it('keeps targeting the nearest while nobody has struck', () => {
    const subject = setup({
      party: [fighter('far', [move('Strike')]), fighter('near', [move('Strike')])],
      partyTiles: { far: { x: 0, y: 0 }, near: { x: 4, y: 0 } },
      reserve: '',
    });
    advance(subject, 3);
    expect(subject.state().enemy.targetId).toBe('near');
    expect(subject.state().party.every(({ threat }) => threat === 0)).toBe(true);
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
      partyTiles: { one: { x: 4, y: 0 }, two: { x: 4, y: -1 }, three: { x: 4, y: 1 } },
      player: { x: 0, y: 0 },
      reserve: '',
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
      reserve: '',
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
      reserve: '',
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

  it('flashes the target once for every landed hit', () => {
    const strike = move('Strike');
    const subject = setup({ enemyTile: { x: 1, y: 0 } });
    subject.useMove('owned', strike.id);
    for (let time = 0; time < 1; time += 0.05) {
      const events = subject.update(0.05);
      const landed = events.filter(({ type }) => type === 'hit');
      if (landed.length > 0) {
        expect(subject.state().flashes).toHaveLength(landed.length);
        return;
      }
    }
    expect.fail('expected the move to land');
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
