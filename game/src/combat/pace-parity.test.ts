import { describe, expect, it } from 'vitest';
import { buildArenaIndividual, enemy, rosterMember } from '../arena/roster.js';
import type { Individual } from '../creatures/individual.js';
import { createRng } from '../engine/rng.js';
import { createPlayerController } from '../player/controller.js';
import { buildArena } from '../scenarios/scenarios.js';
import { tileToWorld } from '../world/tiles.js';
import { createEncounter, type Point } from './encounter.js';
import { arenaSpeedTilesPerSecond } from './pace.js';

type Driver = 'controller-only' | 'harness-shaped';
type Measurement = {
  driver: Driver;
  speed: number;
  rule: number;
  rulePerTick: number;
  distance: number;
  ticks: number;
  movingTicks: number;
  stalledTicks: number;
  medianMovingDisplacement: number;
  maxDisplacement: number;
  meanSpeed: number;
  meanSpeedRatio: number;
  movingMeanSpeed: number;
  movingMeanSpeedRatio: number;
};

const dt = 1 / 60;
const start = { x: 5.5, y: 15.5 };
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const individualAtSpeed = (speed: number): Individual => {
  const base = buildArenaIndividual(rosterMember('loamox')!);
  return { ...base, stats: { ...base.stats, speed } };
};
const controller = (speed: number) =>
  createPlayerController({
    grid: buildArena(11, 22, 'forest'),
    canvas: {} as HTMLCanvasElement,
    cols: () => 11,
    rows: () => 22,
    start: tileToWorld(start.x - 0.5, start.y - 0.5),
    screenFlipping: false,
    diagonals: true,
    speedTilesPerSecond: arenaSpeedTilesPerSecond(speed),
  });

const summarize = (driver: Driver, speed: number, displacements: number[]): Measurement => {
  const moving = displacements.filter((value) => value > 1e-9).sort((a, b) => a - b);
  const travelled = displacements.reduce((sum, value) => sum + value, 0);
  const median =
    moving.length % 2 === 0
      ? (moving[moving.length / 2 - 1]! + moving[moving.length / 2]!) / 2
      : moving[Math.floor(moving.length / 2)]!;
  const rule = arenaSpeedTilesPerSecond(speed);
  const meanSpeed = travelled / (displacements.length * dt);
  const movingMeanSpeed = travelled / (moving.length * dt);
  return {
    driver,
    speed,
    rule,
    rulePerTick: rule * dt,
    distance: travelled,
    ticks: displacements.length,
    movingTicks: moving.length,
    stalledTicks: displacements.length - moving.length,
    medianMovingDisplacement: median,
    maxDisplacement: Math.max(...displacements),
    meanSpeed,
    meanSpeedRatio: meanSpeed / rule,
    movingMeanSpeed,
    movingMeanSpeedRatio: movingMeanSpeed / rule,
  };
};

const measureControllerOnly = (speed: number): Measurement => {
  const subject = controller(speed);
  subject.moveTo({ tx: 5, ty: 7 });
  const displacements: number[] = [];
  do {
    const before = subject.tile;
    subject.update(dt);
    displacements.push(distance(before, subject.tile));
  } while (subject.moving);
  return summarize('controller-only', speed, displacements);
};

const measureHarnessShaped = (speed: number): Measurement => {
  const grid = buildArena(11, 22, 'forest');
  const member = individualAtSpeed(speed);
  const foeBase = buildArenaIndividual(enemy('antlerback')!);
  // Enemy pace is `(3 + 0.6 * speed) / 2 * ARENA_PACE`, so -5 makes this foe stationary.
  const foe = { ...foeBase, stats: { ...foeBase.stats, speed: -5 } };
  const positions: Record<string, Point> = { [member.id]: { ...start } };
  const encounter = createEncounter({
    party: [member],
    enemy: foe,
    grid,
    rng: createRng(1),
    player: { x: 5.5, y: 3.5 },
    partyTiles: positions,
    enemyTile: { x: 5.5, y: 1.5 },
    reserve: '',
  });
  const foeStart = { ...encounter.state().enemy.tile };
  const subject = createPlayerController({
    grid,
    canvas: {} as HTMLCanvasElement,
    cols: () => 11,
    rows: () => 22,
    start: tileToWorld(start.x - 0.5, start.y - 0.5),
    screenFlipping: false,
    diagonals: true,
    speedTilesPerSecond: arenaSpeedTilesPerSecond(speed),
  });
  const displacements: number[] = [];
  let travelled = 0;
  while (travelled < 8 && displacements.length < 1_000) {
    encounter.update(dt, positions, { x: 5.5, y: 3.5 });
    const memberState = encounter.state().party[0]!;
    subject.nudge(memberState.tile.x, memberState.tile.y);
    if (!subject.moving && memberState.desiredTile)
      subject.moveTo({
        tx: Math.floor(memberState.desiredTile.x),
        ty: Math.floor(memberState.desiredTile.y),
      });
    const before = subject.tile;
    subject.update(dt);
    const step = distance(before, subject.tile);
    displacements.push(step);
    travelled += step;
    positions[member.id] = subject.tile;
  }
  if (travelled < 8) throw new Error('Harness-shaped driver did not complete the plain approach');
  expect(encounter.state().enemy.tile).toEqual(foeStart);
  return summarize('harness-shaped', speed, displacements);
};

const measure = (driver: Driver, speed: number): Measurement =>
  driver === 'controller-only' ? measureControllerOnly(speed) : measureHarnessShaped(speed);

describe('arena pace parity', () => {
  it("keeps the harness's walking speed within 2% of the game's speed rule at speed 4 and speed 7", () => {
    for (const speed of [4, 7]) {
      for (const driver of ['controller-only', 'harness-shaped'] as const) {
        const result = measure(driver, speed);
        expect(result.medianMovingDisplacement, JSON.stringify(result)).toBeCloseTo(
          arenaSpeedTilesPerSecond(speed) / 60,
          9,
        );
        expect(result.movingMeanSpeedRatio, JSON.stringify(result)).toBeGreaterThanOrEqual(0.98);
        expect(result.movingMeanSpeedRatio, JSON.stringify(result)).toBeLessThanOrEqual(1.02);
      }
    }
  });
});

export { measureControllerOnly, measureHarnessShaped };
export type { Measurement };
